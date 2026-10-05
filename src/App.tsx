import { useEffect, useState } from "react";

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

function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Post | null>(null);
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

  async function loadPosts() {
    try {
      setLoading(true);

      const response = await fetch(`${API_URL}?action=posts`);
      const text = await response.text();
      const data = JSON.parse(text);

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

      const text = await response.text();
      const data = JSON.parse(text);

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

        if (selected?.id === id) {
          setSelected({
            ...selected,
            likes: data.likes,
          });
        }
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
        <div className="brand">Renggani Gallery</div>

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
          <section className="gallery-grid">
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
                    <p className="caption">{post.caption}</p>

                    <button
                      className={`like-button ${
                        liked ? "liked" : ""
                      }`}
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
        <div
          className="viewer"
          onClick={() => setSelected(null)}
        >
          <button
            className="viewer-close"
            onClick={() => setSelected(null)}
          >
            ×
          </button>

          <div
            className="viewer-content"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={selected.image_url}
              alt={selected.caption || "Gallery image"}
            />

            <div className="viewer-info">
              <p>{selected.caption}</p>

              <button
                className="viewer-like"
                onClick={() => likePost(selected.id)}
              >
                {localStorage.getItem(
                  `gallery_liked_${selected.id}`
                )
                  ? "♥"
                  : "♡"}{" "}
                {selected.likes}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type AdminPanelProps = {
  posts: Post[];
  onRefresh: () => void | Promise<void>;
  onLogout: () => void;
};

function AdminPanel({
  posts,
  onRefresh,
  onLogout,
}: AdminPanelProps) {
  const [image, setImage] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  async function upload() {
    if (!image) {
      alert("Pilih gambar terlebih dahulu.");
      return;
    }

    try {
      setUploading(true);

      const base64 = await fileToBase64(image);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "upload",
          adminKey: ADMIN_KEY,
          imageBase64: base64,
          mimeType: image.type,
          caption,
        }),
      });

      const text = await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Server mengirim response yang tidak valid.`
        );
      }

      if (!data.success) {
        throw new Error(
          data.message || "Server menolak upload."
        );
      }

      alert("Gambar berhasil diupload.");

      setImage(null);
      setCaption("");

      const input =
        document.getElementById(
          "image-upload"
        ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      await onRefresh();
    } catch (error) {
      console.error("UPLOAD ERROR:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat upload.";

      alert(`Upload gagal.\n\n${message}`);
    } finally {
      setUploading(false);
    }
  }

  async function deletePost(id: string) {
    const confirmed = window.confirm(
      "Hapus gambar ini?"
    );

    if (!confirmed) {
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

      const text = await response.text();
      const data = JSON.parse(text);

      if (data.success) {
        await onRefresh();
      } else {
        alert(data.message || "Gagal menghapus.");
      }
    } catch (error) {
      console.error("Delete gagal:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal menghapus."
      );
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Gallery Admin</h1>
          <p>Kelola posting gallery</p>
        </div>

        <button
          className="logout-button"
          onClick={onLogout}
        >
          Keluar
        </button>
      </header>

      <main className="admin-content">
        <section className="upload-box">
          <h2>Upload gambar</h2>

          <label
            className="file-label"
            htmlFor="image-upload"
          >
            {image
              ? image.name
              : "Pilih gambar dari HP"}
          </label>

          <input
            id="image-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file =
                event.target.files?.[0] || null;

              setImage(file);
            }}
          />

          <textarea
            placeholder="Caption..."
            value={caption}
            onChange={(event) =>
              setCaption(event.target.value)
            }
          />

          <button
            className="upload-button"
            onClick={upload}
            disabled={uploading}
          >
            {uploading
              ? "Mengupload..."
              : "Upload"}
          </button>
        </section>

        <section className="admin-posts">
          <div className="admin-posts-title">
            <h2>Posting</h2>

            <button onClick={onRefresh}>
              Refresh
            </button>
          </div>

          {posts.length === 0 ? (
            <div className="state">
              Belum ada posting.
            </div>
          ) : (
            <div className="admin-list">
              {posts.map((post) => (
                <div
                  className="admin-item"
                  key={post.id}
                >
                  <img
                    src={post.image_url}
                    alt={post.caption}
                  />

                  <div className="admin-item-info">
                    <p>{post.caption}</p>

                    <small>
                      ♥ {post.likes} · Views{" "}
                      {post.views}
                    </small>
                  </div>

                  <button
                    className="delete-button"
                    onClick={() =>
                      deletePost(post.id)
                    }
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

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let binary = "";
  const chunkSize = 8192;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(
      i,
      Math.min(i + chunkSize, bytes.length)
    );

    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export default App;
