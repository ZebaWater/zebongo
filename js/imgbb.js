export const IMGBB_API_KEY = 'eb69aad23e3b35cbc6c0fa989dc38dc5';

// Client-side file-size guardrail (bytes). imgBB itself allows up to 32MB on
// free plans, but profile pics should be small. Reject before uploading to
// save the round-trip.
export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Upload a File/Blob to imgBB and return { url, deleteUrl }.
 * Throws on HTTP errors, size-violation, or missing API key.
 */
export async function uploadToImgBB(file) {
  if (!IMGBB_API_KEY) {
  throw new Error('imgBB API key not configured — see js/imgbb.js');
 }
  if (!file) throw new Error('No file selected');
  if (!/^image\//.test(file.type)) throw new Error('File is not an image');
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`File is too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB)`);
  }

  // imgBB accepts multipart/form-data with the raw file as `image`.
  const form = new FormData();
  form.append('image', file);

  const res = await fetch(
    `https://api.imgbb.com/1/upload?key=${encodeURIComponent(IMGBB_API_KEY)}`,
    { method: 'POST', body: form },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`imgBB upload failed (HTTP ${res.status}): ${text.slice(0, 120)}`);
  }
  const json = await res.json();
  if (!json?.success || !json.data?.url) {
    throw new Error('imgBB upload returned no url');
  }
  return {
    url:       json.data.url,
    deleteUrl: json.data.delete_url || '',
  };
}

/**
 * Attempt a best-effort cleanup of an old imgBB image by navigating to its
 * delete URL in a hidden iframe. In practice this usually doesn't complete
 * the delete (imgBB requires a click on the confirmation page), but it's
 * a harmless attempt. The definitive way is to open the URL in a tab and
 * let the user confirm.
 *
 * Caller should treat this as fire-and-forget and NOT rely on it having
 * actually deleted the image.
 */
export function tryCleanupImgBB(deleteUrl) {
  if (!deleteUrl) return;
  try {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;left:-9999px';
    iframe.src = deleteUrl;
    document.body.appendChild(iframe);
    // Remove it after a few seconds regardless of load state
    setTimeout(() => { try { iframe.remove(); } catch (_) {} }, 5000);
  } catch (_) {}
}