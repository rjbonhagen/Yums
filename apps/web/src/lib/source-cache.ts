import { unstable_cache } from "next/cache"

/** A new time window must fetch the source successfully. Next's ordinary
 * timed revalidation can keep serving the previous value after refresh
 * errors; window arguments prevent that value from surviving an outage. */
export function cacheLiveSource<T>(fetchSource: () => Promise<T>, key: string, seconds: number): () => Promise<T> {
  const read = unstable_cache(async (window: number) => {
    // The argument participates in Next's cache key even though the source
    // request itself does not need it.
    void window
    return fetchSource()
  }, [key, String(seconds)], { revalidate: seconds })
  return () => read(Math.floor(Date.now() / (seconds * 1000)))
}
