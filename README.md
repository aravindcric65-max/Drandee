# DRANDEE                                                                                                     A calm, impact-first digital platform. Build for creators, learners, and meaningful discovery.                                                                                                                                                                                                                    ##Focus                                                                                                           - Quality over attention                                                                                                         - Data over noise                                                                                                             - Growth without pressure                                                                                                        ##Status                                                                                                                                                                                                                          Initial setup phase.                           
# Video Upload Studio

Complete video upload and publishing system for Drandee.

## Features

- ✅ Upload videos (MP4, MOV, WebM)
- ✅ Record from camera
- ✅ Preview & edit
- ✅ Trim & crop
- ✅ Add music from library
- ✅ AI-powered captions
- ✅ Privacy settings
- ✅ Upload progress tracking
- ✅ Success state
- ✅ Respect system (not likes!)

## Usage

```jsx
import VideoUploadStudio from '../components/studio/VideoUploadStudio';

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
          }}
        />
      )}
    </>
  );
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `onClose` | function | Called when studio is closed |
| `onSuccess` | function | Called when upload completes |
| `initialData` | object | Pre-fill caption, hashtags, etc. |

## Components

- `UploadEntry` - Initial upload/record screen
- `VideoPreview` - Preview video with controls
- `VideoEditor` - Trim, crop, cover selection
- `AudioPanel` - Add music from library
- `CaptionAssistant` - Caption with AI assist
- `PrivacyPanel` - Privacy & settings
- `UploadProgress` - Upload progress indicator
- `UploadSuccess` - Success state

## Hooks

- `useVideoUpload` - Upload logic
- `useVideoRecorder` - Camera recording
- `useMediaValidation` - File validation

## Services

- `imageKitService` - ImageKit upload
- `mediaApi` - Backend API calls

## File Structure


## Brand Colors

- Primary: `#9c27b0` (Purple)
- Secondary: `#c51162` (Pink)
- Success: `#2e7d32` (Green)

## Terminology

✅ **Respects** (not likes)
✅ **Respect Button** (not like button)
✅ **Total Respects** (not total likes)

## Requirements

- React 18+
- Framer Motion
- Lucide React
- Tailwind CSS

## License

Proprietary - Drandee