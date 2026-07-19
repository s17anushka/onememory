import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

// Runs entirely locally (downloads model weights once, then cached).
// No paid API calls -- this is what keeps the whole project on free tiers.
let extractor: FeatureExtractionPipeline | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    extractor = (await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    )) as FeatureExtractionPipeline;
  }
  return extractor;
}

/**
 * Produces a 384-dimensional embedding for a piece of text.
 * Matches the VECTOR(384) column defined in schema.sql.
 */
export async function embed(text: string): Promise<number[]> {
  const model = await getExtractor();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}
