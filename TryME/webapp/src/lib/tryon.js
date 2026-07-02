export async function runTryOn(modelImageUrl, garmentImageUrl) {
  await new Promise(r => setTimeout(r, 2000));
  return garmentImageUrl;
}
