import { berkeleyLiveSource, graduateLiveSource, ingestSource } from "@yums/event-ingestion"
import { cacheLiveSource } from "./source-cache"

export const getCachedBerkeleyEvents = cacheLiveSource(() => ingestSource(berkeleyLiveSource), "berkeley-live-events", 120)
export const getCachedGraduateEvents = cacheLiveSource(() => ingestSource(graduateLiveSource), "graduate-events", 120)
