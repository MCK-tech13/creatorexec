import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

export const FOUNDER_VIDEO_SRC = '/videos/founder-video.mp4'

const FOUNDER_VIDEO_ASPECT = '1080/608'

interface FounderVideoProps {
  videoSrc?: string
  className?: string
}

export function FounderVideo({ videoSrc = FOUNDER_VIDEO_SRC, className = '' }: FounderVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isMuted, setIsMuted] = useState(true)
  const [videoError, setVideoError] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || videoError) {
      return
    }

    video.muted = isMuted

    const playVideo = async () => {
      try {
        await video.play()
      } catch {
        // Browser may block autoplay when unmuted; muted autoplay should still work.
      }
    }

    void playVideo()
  }, [isMuted, videoError, videoSrc])

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) {
      return
    }

    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    video.muted = nextMuted

    if (!nextMuted) {
      void video.play().catch(() => {})
    }
  }

  return (
    <div
      className={`relative w-full overflow-hidden border border-border-warm bg-white shadow-[0_2px_14px_rgba(26,74,58,0.06)] ${className}`.trim()}
      style={{ aspectRatio: FOUNDER_VIDEO_ASPECT }}
    >
      {videoError ? (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <p className="text-center font-body text-sm text-stone sm:text-base">
            Founder video could not be loaded. Try refreshing the page.
          </p>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            key={videoSrc}
            src={videoSrc}
            autoPlay
            muted={isMuted}
            playsInline
            preload="auto"
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
            onError={() => setVideoError(true)}
            className="h-full w-full object-contain"
            aria-label="Founder introduction video"
          />
          <button
            type="button"
            onClick={toggleMute}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 border border-border-warm bg-white/95 px-2.5 py-1.5 font-body text-xs font-medium text-ink shadow-sm transition hover:bg-white sm:bottom-4 sm:right-4 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
            aria-pressed={!isMuted}
            aria-label={isMuted ? 'Unmute founder video' : 'Mute founder video'}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4 shrink-0 text-stone" aria-hidden />
            ) : (
              <Volume2 className="h-4 w-4 shrink-0 text-emerald" aria-hidden />
            )}
            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>
        </>
      )}
    </div>
  )
}
