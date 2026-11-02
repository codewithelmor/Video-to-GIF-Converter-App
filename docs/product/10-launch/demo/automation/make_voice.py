"""Generate per-scene voice-over with edge-tts (en-US-AndrewNeural) -> audio/<id>.wav + durations.json"""
import asyncio, json, os, subprocess, sys
import edge_tts
base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE, RATE = "en-US-AndrewNeural", sys.argv[1] if len(sys.argv) > 1 else "-4%"
scenes = json.load(open(os.path.join(base, "scenes.json")))["scenes"]
os.makedirs(os.path.join(base, "audio"), exist_ok=True)
async def main():
    dur = {}
    for s in scenes:
        mp3 = os.path.join(base, "audio", s["id"] + ".mp3"); wav = mp3[:-4] + ".wav"
        await edge_tts.Communicate(s["voiceover"], VOICE, rate=RATE).save(mp3)
        subprocess.run(["ffmpeg","-y","-v","error","-i",mp3,"-af","silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse","-ar","48000","-ac","1","-sample_fmt","s16",wav],check=True)
        d = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",wav],capture_output=True,text=True).stdout)
        dur[s["id"]] = round(d, 2); os.remove(mp3)
    json.dump(dur, open(os.path.join(base,"audio","durations.json"),"w"), indent=1)
    tot = sum(dur.values()); words = sum(len(s["voiceover"].split()) for s in scenes)
    print(dur, f"total {tot:.1f}s, {words/tot*60:.0f} wpm")
asyncio.run(main())
