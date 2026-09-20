"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { attachVolunteerPhoto, removeVolunteerPhoto } from "@/app/admin/(protected)/volunteers/actions";
import { MAX_PHOTO_BYTES, PHOTO_BUCKET } from "@/lib/config";
import { getSupabaseEnv } from "@/lib/env";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { buildPhotoObjectName, sniffImageType, type PhotoMime } from "@/lib/validation/photo";

type Props = {
  volunteerId: string;
  volunteerName: string;
  /** Short-lived signed URL of the current photo, or null when there is none. */
  currentPhotoUrl: string | null;
};

type Phase = "idle" | "ready" | "uploading" | "saving" | "removing";

type Picked = { file: File; mime: PhotoMime; previewUrl: string };

/**
 * Real photo upload for administrators.
 *  1. The chosen file is checked in the browser (type from its actual bytes, size <= 5 MB).
 *  2. It is uploaded straight to the private Storage bucket with the admin's own session, so
 *     Row Level Security decides whether the upload is allowed. The bucket also enforces the
 *     size limit and image types on the server.
 *  3. A server action then verifies the stored object and attaches it to the volunteer.
 * Files go directly to Storage because Vercel functions cap request bodies at about 4.5 MB.
 */
export function PhotoUploader({ volunteerId, volunteerName, currentPhotoUrl }: Props) {
  const router = useRouter();
  const inputId = useId();
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [picked, setPicked] = useState<Picked | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Release the preview object URL when it is replaced or the component unmounts.
  useEffect(() => {
    const url = picked?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [picked]);

  useEffect(() => () => xhrRef.current?.abort(), []);

  const busy = phase === "uploading" || phase === "saving" || phase === "removing";

  async function choose(file: File | undefined) {
    setError(null);
    setMessage(null);
    if (!file) return;

    if (file.size <= 0) {
      setError("This file is empty.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(`This image is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The maximum is ${MAX_PHOTO_BYTES / (1024 * 1024)} MB.`);
      return;
    }

    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const mime = sniffImageType(head);
    if (!mime) {
      setError("This file is not a JPEG, PNG or WebP image. Choose a different photo.");
      return;
    }
    if (file.type && file.type !== mime) {
      setError("The file's type does not match its contents. Export it again as JPEG, PNG or WebP.");
      return;
    }

    setPicked({ file, mime, previewUrl: URL.createObjectURL(file) });
    setPhase("ready");
    setProgress(0);
  }

  function clearPick() {
    setPicked(null);
    setPhase("idle");
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  function sendToStorage(objectName: string, file: File, accessToken: string): Promise<void> {
    const { url, anonKey } = getSupabaseEnv();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("POST", `${url}/storage/v1/object/${PHOTO_BUCKET}/${objectName}`);
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      xhr.setRequestHeader("apikey", anonKey);
      xhr.setRequestHeader("x-upsert", "false");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        if (xhr.status === 401 || xhr.status === 403) {
          return reject(new Error("You are not allowed to upload photos. Sign in again as an administrator."));
        }
        if (xhr.status === 413) return reject(new Error("The server rejected the file as too large (5 MB maximum)."));
        if (xhr.status === 415 || xhr.status === 400) {
          return reject(new Error("The server rejected the file. Use a JPEG, PNG or WebP image up to 5 MB."));
        }
        reject(new Error(`The upload failed (error ${xhr.status}). Try again.`));
      };
      xhr.onerror = () => reject(new Error("The upload could not reach the server. Check your connection and try again."));
      xhr.onabort = () => reject(new Error("The upload was cancelled."));

      // Same multipart shape the Supabase client library sends.
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      xhr.send(body);
    });
  }

  async function upload() {
    if (!picked || busy) return;
    setError(null);
    setMessage(null);
    setPhase("uploading");
    setProgress(0);

    const objectName = buildPhotoObjectName(volunteerId, picked.mime);
    const supabase = createBrowserSupabase();

    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) throw new Error("Your session has expired. Sign in again to upload.");

      await sendToStorage(objectName, picked.file, data.session.access_token);

      setPhase("saving");
      const result = await attachVolunteerPhoto(volunteerId, objectName);
      if (!result.ok) {
        // Clean up the file we just stored; the server may already have removed it.
        await supabase.storage.from(PHOTO_BUCKET).remove([objectName]);
        throw new Error(result.error);
      }

      clearPick();
      setMessage("Photo saved.");
      router.refresh();
    } catch (caught) {
      setPhase("ready");
      setError(caught instanceof Error ? caught.message : "The upload failed. Try again.");
    }
  }

  async function remove() {
    setError(null);
    setMessage(null);
    setPhase("removing");
    const result = await removeVolunteerPhoto(volunteerId);
    setConfirmingRemove(false);
    if (!result.ok) {
      setPhase("idle");
      setError(result.error);
      return;
    }
    setPhase("idle");
    setMessage("Photo removed.");
    router.refresh();
  }

  const shownUrl = picked?.previewUrl ?? currentPhotoUrl;

  return (
    <section aria-labelledby={`${inputId}-heading`} className="panel p-5">
      <h2 id={`${inputId}-heading`} className="text-xl font-semibold">
        Photo
      </h2>
      <p className="mt-1 text-sm text-mist">JPEG, PNG or WebP, up to 5 MB. A portrait works best.</p>

      <div className="mt-4 overflow-hidden rounded-[1.05rem] bg-coal-2">
        <div className="relative aspect-[4/5] w-full">
          {shownUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownUrl} alt={picked ? `Preview of new photo for ${volunteerName}` : `Current photo of ${volunteerName}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-dim">No photo yet</div>
          )}
        </div>
      </div>

      <div
        className={`mt-4 rounded-2xl border border-dashed p-4 text-center transition-colors ${dragging ? "border-g-blue bg-g-blue/10" : "border-line-strong"}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy) void choose(event.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(event) => void choose(event.target.files?.[0])}
        />
        <label htmlFor={inputId} className={`btn ${busy ? "opacity-50" : ""}`}>
          {currentPhotoUrl || picked ? "Choose a different photo" : "Choose a photo"}
        </label>
        <p className="mt-2 text-xs text-dim">or drop an image here</p>
      </div>

      {picked && (
        <div className="mt-4 space-y-3">
          <p className="break-all text-sm text-mist">
            {picked.file.name} ({(picked.file.size / 1024).toFixed(0)} KB)
          </p>

          {(phase === "uploading" || phase === "saving") && (
            <div>
              <label htmlFor={`${inputId}-progress`} className="mb-1 block text-sm text-mist">
                {phase === "uploading" ? `Uploading ${progress}%` : "Saving..."}
              </label>
              <progress id={`${inputId}-progress`} value={phase === "saving" ? 100 : progress} max={100} className="h-2 w-full accent-[var(--color-g-blue)]" />
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={() => void upload()} disabled={busy}>
              {picked && currentPhotoUrl ? "Replace photo" : "Upload photo"}
            </button>
            <button type="button" className="btn" onClick={clearPick} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {currentPhotoUrl && !picked && (
        <div className="mt-4">
          {confirmingRemove ? (
            <div className="rounded-2xl border border-danger/40 p-4">
              <p className="text-sm">Remove this photo? The profile will show initials instead.</p>
              <div className="mt-3 flex gap-3">
                <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove()} disabled={busy}>
                  {phase === "removing" ? "Removing..." : "Yes, remove"}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setConfirmingRemove(false)} disabled={busy}>
                  Keep photo
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirmingRemove(true)} disabled={busy}>
              Remove photo
            </button>
          )}
        </div>
      )}

      <div id={statusId} aria-live="polite" className="mt-4 min-h-6">
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {message && !error && <p className="text-sm text-ok">{message}</p>}
      </div>
    </section>
  );
}
