'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import Image from 'next/image';

export default function Home() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [cameraImage, setCameraImage] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load face-api.js models
  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = 'models';
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        console.log('Face-api models loaded');
      } catch (error) {
        console.error('Error loading face-api models:', error);
      }
    };
    loadModels();

    // Cleanup function to stop camera when component unmounts
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setUploadedImage(e.target.result as string);
          setVerificationResult(null); // Reset result when new image uploaded
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 300 },
          height: { ideal: 300 }
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please ensure camera permissions are granted.');
    }
  };

  const captureImage = () => {
    if (canvasRef.current && videoRef.current) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        setCameraImage(canvas.toDataURL('image/jpeg'));
        setVerificationResult(null); // Reset result when new capture taken
      }
    }
  };

  const verifyFaces = async () => {
    if (!uploadedImage || !cameraImage) {
      setVerificationResult('Please upload an image and capture a camera image first.');
      return;
    }

    setIsLoading(true);
    try {
      const uploadedImg = await faceapi.fetchImage(uploadedImage);
      const cameraImg = await faceapi.fetchImage(cameraImage);

      const uploadedDetections = await faceapi
        .detectSingleFace(uploadedImg)
        .withFaceLandmarks()
        .withFaceDescriptor();
        
      const cameraDetections = await faceapi
        .detectSingleFace(cameraImg)
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!cameraDetections) {
        console.error('No face detected in the camera image.');
      }
      
      console.log('Captured Camera Image:', cameraImage);

      console.log('Uploaded Detections:', uploadedDetections);
      console.log('Camera Detections:', cameraDetections);

      if (uploadedDetections && cameraDetections) {
        console.log('Detections:', uploadedDetections, cameraDetections);

        const distance = faceapi.euclideanDistance(
          uploadedDetections.descriptor,
          cameraDetections.descriptor
        );
        const threshold = 0.6;
        const isMatch = distance < threshold;
        setVerificationResult(
          isMatch
            ? `Match! Confidence: ${((1 - distance / threshold) * 100).toFixed(1)}%`
            : 'No Match - Different persons detected'
        );
      } else {
        setVerificationResult('Face not detected in one or both images. Please try again with clearer images.');
      }
    } catch (error) {
      console.error('Error during face verification:', error);
      setVerificationResult('Error occurred during verification. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 text-black p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-center mb-8">Face Verification System</h1>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Image Upload Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">1. Upload Reference Image</h2>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {uploadedImage && (
              <div className="mt-4">
                <Image
                  src={uploadedImage}
                  alt="Uploaded"
                  width={300}
                  height={300}
                  className="w-full max-w-[300px] h-auto rounded-lg border-2 border-gray-200"
                />
              </div>
            )}
          </div>

          {/* Camera Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">2. Capture Live Image</h2>
            <div className="space-y-4">
              <video
                ref={videoRef}
                width={300}
                height={300}
                className="rounded-lg border-2 border-gray-200"
                autoPlay
                muted
              />
              <div className="flex gap-4">
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Start Camera
                </button>
                <button
                  onClick={captureImage}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Capture
                </button>
              </div>
              <canvas
                ref={canvasRef}
                width={300}
                height={300}
                className="hidden"
              />
              {cameraImage && (
                <Image
                  src={cameraImage}
                  alt="Captured"
                  width={300}
                  height={300}
                  className="rounded-lg border-2 border-gray-200"
                />
              )}
            </div>
          </div>
        </div>

        {/* Verification Section */}
        <div className="mt-8 text-center">
          <button
            onClick={verifyFaces}
            disabled={isLoading || !uploadedImage || !cameraImage}
            className={`px-6 py-3 text-lg font-semibold rounded-lg transition-colors ${isLoading || !uploadedImage || !cameraImage
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
          >
            {isLoading ? 'Verifying...' : 'Verify Faces'}
          </button>

          {verificationResult && (
            <div className={`mt-4 p-4 rounded-lg ${verificationResult.includes('Match!')
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
              }`}>
              <p className="text-lg font-semibold">{verificationResult}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
