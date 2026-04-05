import { useEffect, useMemo, useState } from "react";
import { buildPhotoFilename, formatDateTime } from "../utils/format";
import { getPhotoBlob, removePhotoBlob, savePhotoBlob } from "../db/idb";
import { deletePhoto, getPhotoAccessUrl } from "../db/api";
import { useToast } from "./Toast";
import { createId } from "../utils/uuid";

const TAG_OPTIONS = [
  { value: "lint_buildup", label: "Lint Buildup" },
  { value: "blocked_termination", label: "Blocked Termination" },
  { value: "damaged_or_missing_cover", label: "Cover Missing/Damaged" },
  { value: "improper_termination", label: "Improper Termination" },
  { value: "safety_hazard", label: "Safety Hazard" },
  { value: "access_issue", label: "Access Issue" },
  { value: "maintenance_signal", label: "Maintenance Signal" },
  { value: "service_gap_evidence", label: "Service Gap Evidence" },
  { value: "clean_or_well_maintained", label: "Clean / Well Maintained" },
  { value: "unclear_needs_followup", label: "Unclear / Follow Up" }
];

const IS_IOS =
  typeof navigator !== "undefined" && /iPad|iPhone|iPod/i.test(navigator.userAgent);
const MAX_DIMENSION = IS_IOS ? 1280 : 1600;
const JPEG_QUALITY = IS_IOS ? 0.7 : 0.78;
const RETRY_MAX_DIMENSION = 1024;
const RETRY_JPEG_QUALITY = 0.6;

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const [meta, content] = String(dataUrl || "").split(",");
  if (!meta || !content) return null;
  const match = meta.match(/data:([^;]+);base64/);
  const mime = match ? match[1] : "image/jpeg";
  const binary = atob(content);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    buffer[i] = binary.charCodeAt(i);
  }
  return new Blob([buffer], { type: mime });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    img.src = url;
  });
}

async function compressImage(file, options = {}) {
  if (!file || !file.type.startsWith("image/")) {
    return file;
  }

  const maxDimension = options.maxDimension ?? MAX_DIMENSION;
  const quality = options.quality ?? JPEG_QUALITY;
  let source = null;
  try {
    const bitmap = await createImageBitmap(file);
    source = {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      cleanup: () => {
        if (bitmap.close) bitmap.close();
      }
    };
  } catch (error) {
    source = null;
  }

  if (!source) {
    try {
      const img = await loadImage(file);
      source = {
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        cleanup: () => {}
      };
    } catch (error) {
      return file;
    }
  }

  const { width, height } = source;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    source.cleanup();
    return file;
  }
  try {
    source.draw(ctx, targetWidth, targetHeight);
  } catch (error) {
    source.cleanup();
    return file;
  }
  source.cleanup();

  try {
    const blob = await new Promise((resolve) => {
      if (typeof canvas.toBlob === "function") {
        canvas.toBlob((result) => resolve(result), "image/jpeg", quality);
      } else {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrlToBlob(dataUrl));
      }
    });
    return blob || file;
  } catch (error) {
    return file;
  }
}

function PhotoPreview({ photo }) {
  const [url, setUrl] = useState("");
  const [signedTried, setSignedTried] = useState(false);

  useEffect(() => {
    let active = true;
    let currentUrl = "";

    const load = async () => {
      const blob = await getPhotoBlob(photo.id);
      if (!blob) {
        const accessUrl = await getPhotoAccessUrl(photo);
        if (active) setUrl(accessUrl || "");
        return;
      }
      currentUrl = URL.createObjectURL(blob);
      if (active) setUrl(currentUrl);
    };

    load();
    setSignedTried(false);

    return () => {
      active = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [photo.id, photo.storage_uri, photo.stored_filename, photo.assessment_id]);

  const handleOpen = () => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleError = async () => {
    if (signedTried) return;
    setSignedTried(true);
    const signedUrl = await getPhotoAccessUrl(photo, { forceSigned: true });
    if (signedUrl && signedUrl !== url) {
      setUrl(signedUrl);
    }
  };

  if (!url) {
    return <div className="photo-preview placeholder">No preview</div>;
  }

  return (
    <button type="button" className="photo-preview-button" onClick={handleOpen}>
      <img
        className="photo-preview"
        src={url}
        alt={photo.tag || "Photo"}
        onError={handleError}
      />
      <span className="photo-preview-label">Open</span>
    </button>
  );
}

export default function PhotoUploader({ propertyName, photos, setPhotos, onRetryFailed }) {
  const { showToast } = useToast();
  const inputIdCamera = useMemo(() => `photo-input-camera-${createId()}`, []);
  const inputIdLibrary = useMemo(() => `photo-input-library-${createId()}`, []);
  const [storageInfo, setStorageInfo] = useState({ usage: null, quota: null });
  const [photoBytes, setPhotoBytes] = useState(0);

  useEffect(() => {
    setPhotos((current) => {
      let changed = false;
      const next = current.map((photo) => {
        if (photo.stored_filename) {
          return photo;
        }
        changed = true;
        return {
          ...photo,
          stored_filename: buildPhotoFilename(propertyName, photo.tag, photo.timestamp, photo.id)
        };
      });
      return changed ? next : current;
    });
  }, [propertyName, setPhotos]);

  useEffect(() => {
    let active = true;
    const estimate = async () => {
      if (!navigator.storage?.estimate) return;
      try {
        const { usage, quota } = await navigator.storage.estimate();
        if (active) setStorageInfo({ usage, quota });
      } catch {
        // ignore
      }
    };
    estimate();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const measure = async () => {
      let total = 0;
      for (const photo of photos) {
        const blob = await getPhotoBlob(photo.id);
        if (!blob) continue;
        total += blob.size || 0;
      }
      if (active) setPhotoBytes(total);
    };
    measure();
    return () => {
      active = false;
    };
  }, [photos]);

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const nextPhotos = [];
    const failures = [];

    for (const file of files) {
      const id = createId();
      const timestamp = new Date(Date.now() + nextPhotos.length).toISOString();
      const tag = "unclear_needs_followup";
      try {
        let compressed = await compressImage(file);
        try {
          await savePhotoBlob(id, compressed);
        } catch (error) {
          const retryCompressed = await compressImage(file, {
            maxDimension: RETRY_MAX_DIMENSION,
            quality: RETRY_JPEG_QUALITY
          });
          compressed = retryCompressed;
          try {
            await savePhotoBlob(id, compressed);
          } catch (retryError) {
            const dataUrl = await blobToDataUrl(compressed);
            await savePhotoBlob(id, dataUrl);
          }
        }
        nextPhotos.push({
          id,
          timestamp,
          tag,
          note: "",
          original_filename: file.name,
          stored_filename: buildPhotoFilename(propertyName, tag, timestamp, id),
          storage_uri: `idb://photo/${id}`
        });
      } catch (error) {
        console.error("Photo save failed", error);
        const reason = error?.message || String(error);
        failures.push(`${file.name || "(unnamed)"} (${reason})`);
      }
    }

    if (nextPhotos.length) {
      setPhotos((current) => [...nextPhotos, ...current]);
    }

    if (failures.length) {
      showToast({
        type: "error",
        title: "Photo save failed",
        message: `Failed: ${failures.join(", ")}`
      });
    }

    event.target.value = "";
  };

  const formatBytes = (value) => {
    if (!value || Number.isNaN(value)) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let size = value;
    let idx = 0;
    while (size >= 1024 && idx < units.length - 1) {
      size /= 1024;
      idx += 1;
    }
    return `${size.toFixed(size >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
  };

  const unsavedCount = photos.filter((photo) => !photo.persisted).length;
  const totalCount = photos.length;
  const persistedPhotos = photos.filter((photo) => photo.persisted);
  const uploadedCount = persistedPhotos.filter(
    (photo) => photo.storage_uri && !photo.storage_uri.startsWith("idb://")
  ).length;
  const failedCount = persistedPhotos.filter((photo) => photo.upload_status === "failed").length;
  const uploadingCount = persistedPhotos.filter(
    (photo) => photo.upload_status === "uploading"
  ).length;
  const queuedCount = persistedPhotos.filter((photo) => {
    const uri = photo.storage_uri || "";
    if (uri && !uri.startsWith("idb://")) return false;
    if (photo.upload_status === "failed") return false;
    if (photo.upload_status === "uploading") return false;
    return true;
  }).length;

  const getUploadBadge = (photo) => {
    if (!photo.persisted) return { label: "Draft", className: "draft" };
    const uri = photo.storage_uri || "";
    if (uri && !uri.startsWith("idb://")) return { label: "Uploaded", className: "uploaded" };
    if (photo.upload_status === "uploading") return { label: "Uploading", className: "uploading" };
    if (photo.upload_status === "failed") return { label: "Failed", className: "failed" };
    if (photo.upload_status === "queued") return { label: "Queued", className: "queued" };
    return { label: "Local", className: "local" };
  };

  const updatePhoto = (id, patch) => {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === id
          ? {
              ...photo,
              ...patch,
              dirty: true,
              stored_filename:
                photo.stored_filename ||
                buildPhotoFilename(propertyName, patch.tag ?? photo.tag, photo.timestamp, photo.id)
            }
          : photo
      )
    );
  };

  const handleDelete = async (photo) => {
    try {
      if (photo.persisted) {
        await deletePhoto(photo.id);
      }
      await removePhotoBlob(photo.id);
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      showToast({ type: "success", title: "Photo deleted" });
    } catch (error) {
      console.error("Photo delete failed", error);
      showToast({ type: "error", title: "Delete failed", message: "Could not remove photo." });
    }
  };

  return (
    <div className="section">
      <div className="section-header">Photos</div>
      <div className="photo-status">
        <div>
          <strong>{totalCount}</strong> photo{totalCount === 1 ? "" : "s"} in this visit.
          {unsavedCount ? ` ${unsavedCount} not saved yet.` : " All saved locally."}
        </div>
        <div>Photo storage used (this visit): {formatBytes(photoBytes)}</div>
        {storageInfo?.quota ? (
          <div>
            Device storage for this site: {formatBytes(storageInfo.usage || 0)} used of{" "}
            {formatBytes(storageInfo.quota)}
          </div>
        ) : (
          <div>Device storage estimate not available in this browser.</div>
        )}
        <div className="photo-storage-note">
          Photos are stored locally and uploaded to the server when you save the assessment. Upload failures are
          called out so you can retry.
        </div>
        {persistedPhotos.length ? (
          <div className="photo-upload-summary">
            Uploaded: {uploadedCount} · Queued: {queuedCount} · Uploading: {uploadingCount} · Failed:{" "}
            {failedCount}
          </div>
        ) : null}
        {failedCount ? (
          <div className="photo-status-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => onRetryFailed && onRetryFailed()}
              disabled={!onRetryFailed}
            >
              Retry Failed Uploads
            </button>
          </div>
        ) : null}
      </div>
      <div className="upload-card">
        <div className="upload-actions">
          <label className="primary upload-button" htmlFor={inputIdCamera}>
            Take Photo
          </label>
          <label className="secondary upload-button" htmlFor={inputIdLibrary}>
            Choose from Library
          </label>
        </div>
        <input
          id={inputIdCamera}
          className="file-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFiles}
        />
        <input
          id={inputIdLibrary}
          className="file-input"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
        />
        <div className="upload-hint">Take a new photo or pick from your library.</div>
      </div>

      {photos.length ? (
        <div className="photo-list">
          {[...photos]
            .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
            .map((photo) => {
              const badge = getUploadBadge(photo);
              return (
                <div key={photo.id} className="photo-card">
                  <PhotoPreview photo={photo} />
                  <div className="photo-body">
                    <div className="photo-meta">
                      <div>
                        <div className="photo-filename">{photo.stored_filename}</div>
                        <div className="photo-time">{formatDateTime(photo.timestamp)}</div>
                        <div className={`photo-status-pill ${badge.className}`}>{badge.label}</div>
                        {photo.upload_status === "failed" && photo.upload_error ? (
                          <div className="photo-status-error">{photo.upload_error}</div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDelete(photo)}
                      >
                        Delete
                      </button>
                    </div>
                <div className="tag-grid">
                  {TAG_OPTIONS.map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      className={`tag-button ${photo.tag === option.value ? "is-active" : ""}`}
                      onClick={() => updatePhoto(photo.id, { tag: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                    <textarea
                      className="textarea"
                      rows={2}
                      placeholder="Optional photo note"
                      value={photo.note || ""}
                      onChange={(event) => updatePhoto(photo.id, { note: event.target.value })}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="empty-state">No photos attached yet.</div>
      )}
    </div>
  );
}
