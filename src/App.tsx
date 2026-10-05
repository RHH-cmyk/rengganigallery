import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type TouchEvent,
  type WheelEvent,
} from "react";

const API_URL =
  "https://script.google.com/macros/s/AKfycbw_iyhboIOpNWFnLbTJ5WqM-egtVT-O_jkauT8GgPzq8oP6464Ri-1rdr6ujdpfFxPHCQ/exec";

const ADMIN_KEY = "GALLERY_ADMIN_2026";

type Post = {
  id: string;
  image_url: string;
  caption: string;
  likes: number;
  views: number;
  created_at: string | null;
};

type Point = {
  x: number;
  y: number;
};

type TouchPoint = {
  clientX: number;
  clientY: number;
};

function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Post | null>(null);
  const [closing, setClosing] = useState(false);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    loadPosts();

    if (window.location.hash === "#admin") {
      const saved = sessionStorage.getItem("gallery_admin");

      if (saved === ADMIN_KEY) {
        setAdmin(true);
      }
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  async function loadPosts() {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}?action=posts`);
      const data = await response.json();

      if (data.success) {
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error("Gagal mengambil gallery:", error);
    } finally {
      setLoading(false);
    }
  }

  function openAdmin() {
    const password = window.prompt("Password admin:");

    if (password === ADMIN_KEY) {
      sessionStorage.setItem("gallery_admin", ADMIN_KEY);
      window.location.hash = "admin";
      setAdmin(true);
    } else if (password !== null) {
      alert("Password salah.");
    }
  }

  function logoutAdmin() {
    sessionStorage.removeItem("gallery_admin");
    window.location.hash = "";
    setAdmin(false);
  }

  async function likePost(id: string) {
    const likedKey = `gallery_liked_${id}`;

    if (localStorage.getItem(likedKey)) {
      return;
    }

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "like",
          id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem(likedKey, "1");

        setPosts((current) =>
          current.map((post) =>
            post.id === id
              ? {
                  ...post,
                  likes: data.likes,
                }
              : post
          )
        );

        setSelected((current) =>
          current && current.id === id
            ? {
                ...current,
                likes: data.likes,
              }
            : current
        );
      }
    } catch (error) {
      console.error("Like gagal:", error);
    }
  }

  async function countView(id: string) {
    const viewedKey = `gallery_viewed_${id}`;

    if (localStorage.getItem(viewedKey)) {
      return;
    }

    localStorage.setItem(viewedKey, "1");

    try {
      await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "view",
          id,
        }),
      });
    } catch (error) {
      console.error("View gagal:", error);
    }
  }

  function openPost(post: Post) {
    setSelected(post);
    countView(post.id);
  }

  function closePost() {
    setClosing(true);
    setTimeout(() => {
      setSelected(null);
      setClosing(false);
    }, 350); 
  }

  if (admin) {
    return (
      <AdminPanel
        posts={posts}
        onRefresh={loadPosts}
        onLogout={logoutAdmin}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Renggani</div>
        <button className="admin-button" onClick={openAdmin}>
          Admin
        </button>
      </header>

      <main className="gallery-page">
        {loading ? (
          <div className="state">Memuat gallery...</div>
        ) : posts.length === 0 ? (
          <div className="state">Belum ada gambar.</div>
        ) : (
          <section className="gallery-masonry">
            {posts.map((post) => {
              const liked =
                localStorage.getItem(`gallery_liked_${post.id}`) === "1";

              return (
                <article className="gallery-card" key={post.id}>
                  <button
                    className="image-button"
                    onClick={() => openPost(post)}
                  >
                    <img
                      src={post.image_url}
                      alt={post.caption || "Gallery image"}
                      loading="lazy"
                    />
                  </button>

                  <div className="card-bottom">
                    {post.caption && (
                      <p className="caption">{post.caption}</p>
                    )}

                    <button
                      className={`like-button ${liked ? "liked" : ""}`}
                      onClick={() => likePost(post.id)}
                    >
                      <span>{liked ? "♥" : "♡"}</span>
                      {post.likes}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      {selected && (
        <PostModal
          post={selected}
          liked={
            localStorage.getItem(`gallery_liked_${selected.id}`) === "1"
          }
          isClosing={closing}
          onClose={closePost}
          onLike={() => likePost(selected.id)}
        />
      )}
    </div>
  );
}

/* =====================================================
   INSTAGRAM STYLE POST MODAL
===================================================== */

type PostModalProps = {
  post: Post;
  liked: boolean;
  isClosing: boolean;
  onClose: () => void;
  onLike: () => void;
};

function PostModal({
  post,
  liked,
  isClosing,
  onClose,
  onLike,
}: PostModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const lastTap = useRef(0);

  const gesture = useRef<{
    mode: "none" | "pan" | "pinch";
    startPoint: Point;
    startPosition: Point;
    startDistance: number;
    startScale: number;
  }>({
    mode: "none",
    startPoint: { x: 0, y: 0 },
    startPosition: { x: 0, y: 0 },
    startDistance: 0,
    startScale: 1,
  });

  function resetZoom() {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }

  function distance(a: TouchPoint, b: TouchPoint) {
    const x = b.clientX - a.clientX;
    const y = b.clientY - a.clientY;
    return Math.sqrt(x * x + y * y);
  }

  function touchStart(event: TouchEvent<HTMLImageElement>) {
    event.stopPropagation();

    if (event.touches.length >= 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      gesture.current = {
        mode: "pinch",
        startPoint: { x: 0, y: 0 },
        startPosition: position,
        startDistance: distance(first, second),
        startScale: scale,
      };
      return;
    }

    if (event.touches.length === 1) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        if (scale > 1) {
          resetZoom();
        } else {
          setScale(2.5);
        }
        lastTap.current = 0;
        return;
      }

      lastTap.current = now;
      gesture.current = {
        mode: scale > 1 ? "pan" : "none",
        startPoint: {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        },
        startPosition: position,
        startDistance: 0,
        startScale: scale,
      };
    }
  }

  function touchMove(event: TouchEvent<HTMLImageElement>) {
    event.stopPropagation();
    const current = gesture.current;

    if (current.mode === "pinch" && event.touches.length >= 2) {
      event.preventDefault();
      const first = event.touches[0];
      const second = event.touches[1];
      const ratio = distance(first, second) / current.startDistance;
      const nextScale = Math.min(
        4,
        Math.max(1, current.startScale * ratio)
      );
      setScale(nextScale);
      if (nextScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return;
    }

    if (current.mode === "pan" && event.touches.length === 1 && scale > 1) {
      event.preventDefault();
      const dx = event.touches[0].clientX - current.startPoint.x;
      const dy = event.touches[0].clientY - current.startPoint.y;
      setPosition({
        x: current.startPosition.x + dx,
        y: current.startPosition.y + dy,
      });
    }
  }

  function touchEnd(event: TouchEvent<HTMLImageElement>) {
    event.stopPropagation();
    if (event.touches.length === 0) {
      gesture.current.mode = "none";
      if (scale <= 1.02) {
        resetZoom();
      }
    }
  }

  function wheel(event: WheelEvent<HTMLImageElement>) {
    event.preventDefault();
    const next = Math.min(
      4,
      Math.max(1, scale + (event.deltaY > 0 ? -0.2 : 0.2))
    );
    setScale(next);
    if (next === 1) {
      resetZoom();
    }
  }

  return (
    <div
      className={`modal-layer ${isClosing ? "closing" : ""}`}
      onClick={onClose}
    >
      <div className="modal-backdrop" />
      <button
        className="modal-close"
        onClick={onClose}
        aria-label="Tutup"
      >
        ×
      </button>

      <article
        className="post-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="post-photo">
          {!loaded && <div className="photo-loading">Memuat...</div>}
          <img
            className={`modal-image ${loaded ? "modal-image-ready" : ""}`}
            src={post.image_url}
            alt={post.caption || "Gallery image"}
            draggable={false}
            onLoad={() => setLoaded(true)}
            onTouchStart={touchStart}
            onTouchMove={touchMove}
            onTouchEnd={touchEnd}
            onWheel={wheel}
            style={{
              transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            }}
          />
          {scale > 1 && (
            <button className="zoom-reset" onClick={resetZoom}>
              Reset
            </button>
          )}
        </div>

        <aside className="post-info">
          <div className="post-header">
            <div className="post-avatar">R</div>
            <div className="post-user">
              <strong>Renggani</strong>
              <span>Gallery</span>
            </div>
            <button className="post-more" aria-label="Menu">
              •••
            </button>
          </div>

          <div className="post-caption">
            {post.caption && (
              <>
                <strong>Renggani</strong> {post.caption}
              </>
            )}
          </div>

          <div className="post-actions">
            <button
              className={`modal-like ${liked ? "liked" : ""}`}
              onClick={onLike}
            >
              {liked ? "♥" : "♡"}
            </button>
            <button className="modal-action" onClick={() => {}}>
              ♧
            </button>
            <button className="modal-action" onClick={() => {}}>
              ↗
            </button>
          </div>

          <div className="post-likes">
            {post.likes} {post.likes === 1 ? "like" : "likes"}
          </div>

          <div className="post-date">
            {post.created_at
              ? formatDate(post.created_at)
              : "Renggani Gallery"}
          </div>
        </aside>
      </article>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Renggani Gallery";
  }
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* =====================================================
   ADMIN PANEL WITH PROGRESS TRACKING & GLASS UI
===================================================== */

type AdminPanelProps = {
  posts: Post[];
  onRefresh: () => void | Promise<void>;
  onLogout: () => void;
};

function AdminPanel({ posts, onRefresh, onLogout }: AdminPanelProps) {
  const [imageBase64, setImageBase64] = useState("");
  const [imageName, setImageName] = useState("");
  const [imageMimeType, setImageMimeType] = useState("");
  const [caption, setCaption] = useState("");
  const [reading, setReading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setReading(true);
    setImageBase64("");
    setImageName(file.name);
    setImageMimeType(file.type || "image/jpeg");

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      if (comma === -1) {
        setReading(false);
        alert("Format gambar tidak valid.");
        return;
      }
      setImageBase64(result.substring(comma + 1));
      setReading(false);
    };

    reader.onerror = () => {
      setReading(false);
      alert("Gambar tidak bisa dibaca.");
    };
    reader.readAsDataURL(file);
  }

  // Fungsi khusus melacak progres upload dengan XMLHttpRequest
  const uploadWithProgress = (payload: string) => {
    return new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", API_URL, true);
      xhr.setRequestHeader("Content-Type", "text/plain;charset=utf-8");

      // Melacak progres payload
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (e) {
            resolve({ success: false, message: "Invalid response from server" });
          }
        } else {
          reject(new Error("Gagal menyambung ke server. HTTP " + xhr.status));
        }
      };

      xhr.onerror = () => reject(new Error("Terjadi kesalahan jaringan (Network Error)"));
      xhr.send(payload);
    });
  };

  async function upload() {
    if (reading) {
      alert("Tunggu gambar selesai dibaca.");
      return;
    }
    if (!imageBase64) {
      alert("Pilih gambar terlebih dahulu.");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const payload = JSON.stringify({
        action: "upload",
        adminKey: ADMIN_KEY,
        imageBase64,
        mimeType: imageMimeType,
        caption,
      });

      const data = await uploadWithProgress(payload);

      if (!data.success) {
        throw new Error(data.message || "Upload gagal.");
      }

      alert("Gambar berhasil diupload.");
      setImageBase64("");
      setImageName("");
      setImageMimeType("");
      setCaption("");

      const input = document.getElementById(
        "image-upload"
      ) as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }
      await onRefresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? `Upload gagal.\n\n${error.message}`
          : "Upload gagal."
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function deletePost(id: string) {
    if (!window.confirm("Hapus gambar ini?")) {
      return;
    }

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "delete",
          adminKey: ADMIN_KEY,
          id,
        }),
      });

      const data = await response.json();
      if (data.success) {
        await onRefresh();
      } else {
        alert(data.message || "Gagal menghapus.");
      }
    } catch {
      alert("Gagal menghapus.");
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Gallery Admin</h1>
          <p>Kelola posting gallery</p>
        </div>
        <button className="logout-button" onClick={onLogout}>
          Keluar
        </button>
      </header>

      <main className="admin-content">
        <section className="upload-box glass-panel">
          <h2>Upload gambar baru</h2>
          
          <label className="file-label" htmlFor="image-upload">
            {reading
              ? "Membaca gambar..."
              : imageName || "Ketuk untuk pilih gambar dari HP"}
          </label>
          <input
            id="image-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
          />
          
          <textarea
            placeholder="Tulis caption di sini..."
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
          />

          {uploading && (
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          )}

          <button
            className="upload-button"
            onClick={upload}
            disabled={reading || uploading || !imageBase64}
          >
            {reading
              ? "Membaca gambar..."
              : uploading
              ? `Mengupload... ${uploadProgress}%`
              : "Upload Sekarang"}
          </button>
        </section>

        <section className="admin-posts">
          <div className="admin-posts-title">
            <h2>Posting Tersimpan</h2>
            <button className="refresh-btn" onClick={onRefresh}>Refresh</button>
          </div>

          {posts.length === 0 ? (
            <div className="state">Belum ada posting.</div>
          ) : (
            <div className="admin-list">
              {posts.map((post) => (
                <div className="admin-item glass-panel" key={post.id}>
                  <img src={post.image_url} alt={post.caption} />
                  <div className="admin-item-info">
                    <p>{post.caption || "Tanpa caption"}</p>
                    <small>
                      ♥ {post.likes} · Views {post.views}
                    </small>
                  </div>
                  <button
                    className="delete-button"
                    onClick={() => deletePost(post.id)}
                  >
                    Hapus
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
