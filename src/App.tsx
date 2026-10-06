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

/* =====================================================
   CUSTOM DIALOG HOOK (PENGGANTI ALERT/CONFIRM BROWSER)
===================================================== */
type DialogConfig = {
  isOpen: boolean;
  type: "alert" | "confirm" | "prompt";
  title: string;
  message: string;
  inputValue: string;
  resolve: ((val: any) => void) | null;
};

function useDialog() {
  const [config, setConfig] = useState<DialogConfig>({
    isOpen: false,
    type: "alert",
    title: "",
    message: "",
    inputValue: "",
    resolve: null,
  });

  const showAlert = (title: string, message: string) =>
    new Promise<void>((resolve) => {
      setConfig({ isOpen: true, type: "alert", title, message, inputValue: "", resolve: resolve as any });
    });

  const showConfirm = (title: string, message: string) =>
    new Promise<boolean>((resolve) => {
      setConfig({ isOpen: true, type: "confirm", title, message, inputValue: "", resolve });
    });

  const showPrompt = (title: string, message: string) =>
    new Promise<string | null>((resolve) => {
      setConfig({ isOpen: true, type: "prompt", title, message, inputValue: "", resolve });
    });

  const handleClose = (val: any) => {
    if (config.resolve) config.resolve(val);
    setConfig((prev) => ({ ...prev, isOpen: false }));
  };

  const DialogUI = () => {
    if (!config.isOpen) return null;
    return (
      <div className="glass-dialog-overlay" onClick={() => { if(config.type === 'alert') handleClose(undefined)}}>
        <div className="glass-dialog" onClick={(e) => e.stopPropagation()}>
          <div className="glass-dialog-content">
            <h3>{config.title}</h3>
            <p>{config.message}</p>
            {config.type === "prompt" && (
              <input
                type="password"
                placeholder="Password"
                autoFocus
                value={config.inputValue}
                onChange={(e) => setConfig((p) => ({ ...p, inputValue: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleClose(config.inputValue);
                }}
              />
            )}
          </div>
          <div className={`glass-dialog-actions ${config.type !== "alert" ? "split" : ""}`}>
            {config.type !== "alert" && (
              <button className="cancel-btn" onClick={() => handleClose(config.type === "prompt" ? null : false)}>
                Batal
              </button>
            )}
            <button className="confirm-btn" onClick={() => handleClose(config.type === "prompt" ? config.inputValue : true)}>
              {config.type === "alert" ? "OK" : "Lanjut"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return { showAlert, showConfirm, showPrompt, DialogUI };
}


/* =====================================================
   APP COMPONENT
===================================================== */
function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Post | null>(null);
  const [closing, setClosing] = useState(false);
  const [admin, setAdmin] = useState(false);
  
  const { showAlert, showPrompt, DialogUI } = useDialog();

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

  async function openAdmin() {
    const password = await showPrompt("Akses Admin", "Masukkan password untuk mengelola gallery:");
    
    if (password === ADMIN_KEY) {
      sessionStorage.setItem("gallery_admin", ADMIN_KEY);
      window.location.hash = "admin";
      setAdmin(true);
    } else if (password !== null) {
      await showAlert("Akses Ditolak", "Password yang Anda masukkan salah.");
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
        body: JSON.stringify({ action: "like", id }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem(likedKey, "1");

        setPosts((current) =>
          current.map((post) => post.id === id ? { ...post, likes: data.likes } : post)
        );

        setSelected((current) =>
          current && current.id === id ? { ...current, likes: data.likes } : current
        );
      }
    } catch (error) {
      console.error("Like gagal:", error);
    }
  }

  async function countView(id: string) {
    const viewedKey = `gallery_viewed_${id}`;
    if (localStorage.getItem(viewedKey)) return;

    localStorage.setItem(viewedKey, "1");

    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "view", id }),
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
              const liked = localStorage.getItem(`gallery_liked_${post.id}`) === "1";
              return (
                <article className="gallery-card" key={post.id}>
                  <button className="image-button" onClick={() => openPost(post)}>
                    <img src={post.image_url} alt={post.caption || "Gallery image"} loading="lazy" />
                  </button>
                  <div className="card-bottom">
                    {post.caption && <p className="caption">{post.caption}</p>}
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
          liked={localStorage.getItem(`gallery_liked_${selected.id}`) === "1"}
          isClosing={closing}
          onClose={closePost}
          onLike={() => likePost(selected.id)}
        />
      )}
      
      <DialogUI />
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

function PostModal({ post, liked, isClosing, onClose, onLike }: PostModalProps) {
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
        if (scale > 1) resetZoom();
        else setScale(2.5);
        lastTap.current = 0;
        return;
      }
      lastTap.current = now;
      gesture.current = {
        mode: scale > 1 ? "pan" : "none",
        startPoint: { x: event.touches[0].clientX, y: event.touches[0].clientY },
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
      const nextScale = Math.min(4, Math.max(1, current.startScale * ratio));
      setScale(nextScale);
      if (nextScale === 1) setPosition({ x: 0, y: 0 });
      return;
    }
    if (current.mode === "pan" && event.touches.length === 1 && scale > 1) {
      event.preventDefault();
      const dx = event.touches[0].clientX - current.startPoint.x;
      const dy = event.touches[0].clientY - current.startPoint.y;
      setPosition({ x: current.startPosition.x + dx, y: current.startPosition.y + dy });
    }
  }

  function touchEnd(event: TouchEvent<HTMLImageElement>) {
    event.stopPropagation();
    if (event.touches.length === 0) {
      gesture.current.mode = "none";
      if (scale <= 1.02) resetZoom();
    }
  }

  function wheel(event: WheelEvent<HTMLImageElement>) {
    event.preventDefault();
    const next = Math.min(4, Math.max(1, scale + (event.deltaY > 0 ? -0.2 : 0.2)));
    setScale(next);
    if (next === 1) resetZoom();
  }

  return (
    <div className={`modal-layer ${isClosing ? "closing" : ""}`} onClick={onClose}>
      <div className="modal-backdrop" />
      <button className="modal-close" onClick={onClose} aria-label="Tutup">×</button>

      <article className="post-modal" onClick={(event) => event.stopPropagation()}>
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
          {scale > 1 && <button className="zoom-reset" onClick={resetZoom}>Reset</button>}
        </div>

        <aside className="post-info">
          <div className="post-header">
            <div className="post-avatar">R</div>
            <div className="post-user">
              <strong>Renggani</strong>
              <span>Gallery</span>
            </div>
            <button className="post-more" aria-label="Menu">•••</button>
          </div>

          <div className="post-caption">
            {post.caption && (
              <>
                <strong>Renggani</strong> {post.caption}
              </>
            )}
          </div>

          <div className="post-actions">
            <button className={`modal-like ${liked ? "liked" : ""}`} onClick={onLike}>
              {liked ? "♥" : "♡"}
            </button>
            <button className="modal-action" onClick={() => {}}>♧</button>
            <button className="modal-action" onClick={() => {}}>↗</button>
          </div>

          <div className="post-likes">
            {post.likes} {post.likes === 1 ? "like" : "likes"}
          </div>

          <div className="post-date">
            {post.created_at ? formatDate(post.created_at) : "Renggani Gallery"}
          </div>
        </aside>
      </article>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Renggani Gallery";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/* =====================================================
   ADMIN PANEL WITH FETCH & SIMULATED PROGRESS (IOS SAFARI STYLE)
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

  // Hook Custom Dialog untuk admin
  const { showAlert, showConfirm, DialogUI } = useDialog();

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
        showAlert("File Tidak Valid", "Format gambar yang Anda pilih tidak didukung.");
        return;
      }
      setImageBase64(result.substring(comma + 1));
      setReading(false);
    };

    reader.onerror = () => {
      setReading(false);
      showAlert("Gagal Membaca", "Terjadi kesalahan saat membaca file gambar.");
    };
    reader.readAsDataURL(file);
  }

  async function upload() {
    if (reading) {
      await showAlert("Mohon Tunggu", "Sistem sedang memproses file gambar Anda.");
      return;
    }
    if (!imageBase64) {
      await showAlert("File Kosong", "Silakan pilih gambar terlebih dahulu sebelum upload.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress((oldProgress) => {
        if (oldProgress >= 90) return 90;
        return oldProgress + Math.floor(Math.random() * 8) + 2; 
      });
    }, 400);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "upload",
          adminKey: ADMIN_KEY,
          imageBase64,
          mimeType: imageMimeType,
          caption,
        }),
      });

      const data = await response.json();
      clearInterval(progressInterval); 

      if (!data.success) {
        throw new Error(data.message || "Upload gagal.");
      }

      setUploadProgress(100);

      setTimeout(async () => {
        await showAlert("Berhasil", "Gambar telah berhasil ditambahkan ke Gallery.");
        setImageBase64("");
        setImageName("");
        setImageMimeType("");
        setCaption("");
        
        const input = document.getElementById("image-upload") as HTMLInputElement | null;
        if (input) input.value = "";
        
        setUploading(false);
        setUploadProgress(0);
        await onRefresh();
      }, 500);

    } catch (error) {
      clearInterval(progressInterval); 
      setUploading(false);
      setUploadProgress(0);
      await showAlert("Upload Gagal", error instanceof Error ? error.message : "Terjadi kesalahan saat mengupload gambar.");
    }
  }

  async function deletePost(id: string) {
    const isConfirmed = await showConfirm(
      "Hapus Gambar?", 
      "Gambar ini akan dihapus secara permanen dari Gallery. Lanjutkan?"
    );

    if (!isConfirmed) return;

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "delete", adminKey: ADMIN_KEY, id }),
      });

      const data = await response.json();
      if (data.success) {
        await onRefresh();
      } else {
        await showAlert("Gagal Dihapus", data.message || "Sistem menolak penghapusan.");
      }
    } catch {
      await showAlert("Error Jaringan", "Gagal terhubung ke server saat menghapus.");
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
      
      <DialogUI />
    </div>
  );
}

export default App;
