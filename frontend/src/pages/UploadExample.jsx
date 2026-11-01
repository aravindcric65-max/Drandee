import React, { useState } from 'react';
import VideoUploadStudio from '../components/studio/VideoUploadStudio';
import Button from '../components/ui/Button';

const UploadExample = () => {
  const [showStudio, setShowStudio] = useState(false);

  return (
    <div className="min-h-screen bg-[#FFFFFF] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-[#111111] mb-4">
          Video Upload System - Complete Example
        </h1>
        <p className="text-[#666666] mb-8">
          This demonstrates the complete upload flow from start to finish.
        </p>

        {/* Example 1: Simple Button */}
        <div className="bg-[#F7F7F9] rounded-2xl p-6 mb-6 border border-[#E8E8EC]">
          <h2 className="text-xl font-semibold text-[#111111] mb-4">
            Example 1: Simple Upload Button
          </h2>
          <Button
            variant="primary"
            size="lg"
            onClick={() => setShowStudio(true)}
          >
            Open Upload Studio
          </Button>
        </div>

        {/* Example 2: With Callbacks */}
        <div className="bg-[#F7F7F9] rounded-2xl p-6 mb-6 border border-[#E8E8EC]">
          <h2 className="text-xl font-semibold text-[#111111] mb-4">
            Example 2: With Success Callback
          </h2>
          <VideoUploadStudio
            onClose={() => setShowStudio(false)}
            onSuccess={(media) => {
              console.log('Upload successful!', media);
              alert(`Video uploaded: ${media.mediaId}`);
            }}
          />
        </div>

        {/* Code Example */}
        <div className="bg-[#F7F7F9] rounded-2xl p-6 border border-[#E8E8EC]">
          <h2 className="text-xl font-semibold text-[#111111] mb-4">
            Example 3: Code Usage
          </h2>
          <pre className="bg-[#E8E8EC] rounded-xl p-4 text-sm text-[#666666] overflow-x-auto">
{`// Import the studio
import VideoUploadStudio from '../components/studio/VideoUploadStudio';

// Use in your component
function MyComponent() {
  const [showStudio, setShowStudio] = useState(false);

  return (
    <>
      <button onClick={() => setShowStudio(true)}>
        Upload Video
      </button>
      
      {showStudio && (
        <VideoUploadStudio
          onClose={() => setShowStudio(false)}
          onSuccess={(media) => {
            console.log('Uploaded:', media);
            // Navigate to post or do something
          }}
        />
      )}
    </>
  );
}`}
          </pre>
        </div>
      </div>

      {/* Studio Modal */}
      {showStudio && (
        <VideoUploadStudio onClose={() => setShowStudio(false)} />
      )}
    </div>
  );
};

export default UploadExample;