import { config, higgsfield } from "@higgsfield/client/v2"

config({ credentials: process.env.HF_CREDENTIALS })

try {
  const result = await higgsfield.subscribe("bytedance/seedance-2.5/text-to-video", {
    input: {
      prompt: "A cinematic scene at sunset",
      duration: 5,
      resolution: "720p",
      aspect_ratio: "16:9",
      output_format: "mp4",
      generate_audio: true,
    },
    withPolling: true,
  })

  if (result.status === "completed") {
    const video = typeof result.video === "string" ? result.video : result.video?.url
    if (!video) {
      console.error("Completed but no video URL in result:", JSON.stringify({ status: result.status }))
      process.exit(1)
    }
    console.log(video)
    process.exit(0)
  }

  console.error("Generation not completed:", JSON.stringify({ status: result.status, error: (result as { error?: unknown }).error }))
  process.exit(1)
} catch (error) {
  const name = error instanceof Error ? error.name : "UnknownError"
  const message = error instanceof Error ? error.message : String(error)
  console.error(`${name}: ${message}`)
  process.exit(1)
}
