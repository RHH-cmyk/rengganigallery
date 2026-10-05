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

  useEffect(() => {
    if (!selected) {
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

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

  function closeViewer() {
    setSelected(null);
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

        <button
          className="admin-button"
          onClick={openAdmin}
        >
          Admin
        </button>
      </header>

      <main className="gallery-page">
        {loading ? (
          <div className="state">
            Memuat gallery...
          </div>
        ) : posts.length === 0 ? (
          <div className="state">
            Belum ada gambar.
          </div>
        ) : (
          <section className="gallery-masonry">
            {posts.map((post) => {
              const liked =
                localStorage.getItem(
                  `gallery_liked_${post.id}`
                ) === "1";

              return (
                <article
                  className="gallery-card"
                  key={post.id}
                >
                  <button
                    className="image-button"
                    onClick={() => openPost(post)}
                    aria-label="Buka foto"
                  >
                    <img
                      src={post.image_url}
                      alt={
                        post.caption ||
                        "Gallery image"
                      }
                      loading="lazy"
                    />
                  </button>

                  <div className="card-bottom">
                    {post.caption && (
                      <p className="caption">
                        {post.caption}
                      </p>
                    )}

                    <button
                      className={`like-button ${
                        liked ? "liked" : ""
                      }`}
                      onClick={() =>
                        likePost(post.id)
                      }
                    >
                      <span>
                        {liked ? "♥" : "♡"}
                      </span>
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
        <ImageViewer
          post={selected}
          liked={
            localStorage.getItem(
              `gallery_liked_${selected.id}`
            ) === "1"
          }
          onClose={closeViewer}
          onLike={() =>
            likePost(selected.id)
          }
        />
      )}
    </div>
  );
}


type ImageViewerProps = {
  post: Post;
  liked: boolean;
  onClose: () => void;
  onLike: () => void;
};

function ImageViewer({
  post,
  liked,
  onClose,
  onLike,
}: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] =
    useState<Point>({
      x: 0,
      y: 0,
    });

  const [loaded, setLoaded] =
    useState(false);

  const imageRef =
    useRef<HTMLImageElement | null>(null);

  const gestureRef = useRef<{
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

  const lastTapRef =
    useRef(0);

  function resetZoom() {
    setScale(1);
    setPosition({
      x: 0,
      y: 0,
    });
  }

  function getDistance(
    first: Touch,
    second: Touch
  ) {
    const dx =
      second.clientX -
      first.clientX;

    const dy =
      second.clientY -
      first.clientY;

    return Math.sqrt(
      dx * dx + dy * dy
    );
  }

  function handleTouchStart(
    event: TouchEvent<HTMLImageElement>
  ) {
    event.stopPropagation();

    if (event.touches.length >= 2) {
      const distance = getDistance(
        event.touches[0],
        event.touches[1]
      );

      gestureRef.current = {
        mode: "pinch",
        startPoint: {
          x: 0,
          y: 0,
        },
        startPosition: position,
        startDistance: distance,
        startScale: scale,
      };

      return;
    }

    if (event.touches.length === 1) {
      const now = Date.now();

      if (
        now - lastTapRef.current <
        300
      ) {
        if (scale > 1) {
          resetZoom();
        } else {
          setScale(2.5);
        }

        lastTapRef.current = 0;
        return;
      }

      lastTapRef.current = now;

      gestureRef.current = {
        mode:
          scale > 1
            ? "pan"
            : "none",
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

  function handleTouchMove(
    event: TouchEvent<HTMLImageElement>
  ) {
    event.stopPropagation();

    const gesture =
      gestureRef.current;

    if (
      gesture.mode === "pinch" &&
      event.touches.length >= 2
    ) {
      event.preventDefault();

      const distance = getDistance(
        event.touches[0],
        event.touches[1]
      );

      const ratio =
        distance /
        gesture.startDistance;

      const nextScale = Math.min(
        4,
        Math.max(
          1,
          gesture.startScale *
            ratio
        )
      );

      setScale(nextScale);

      if (nextScale <= 1) {
        setPosition({
          x: 0,
          y: 0,
        });
      }

      return;
    }

    if (
      gesture.mode === "pan" &&
      event.touches.length === 1 &&
      scale > 1
    ) {
      event.preventDefault();

      const dx =
        event.touches[0].clientX -
        gesture.startPoint.x;

      const dy =
        event.touches[0].clientY -
        gesture.startPoint.y;

      setPosition({
        x:
          gesture.startPosition.x +
          dx,
        y:
          gesture.startPosition.y +
          dy,
      });
    }
  }

  function handleTouchEnd(
    event: TouchEvent<HTMLImageElement>
  ) {
    event.stopPropagation();

    if (event.touches.length === 0) {
      gestureRef.current.mode =
        "none";

      if (scale <= 1.02) {
        resetZoom();
      }
    }

    if (
      event.touches.length === 1 &&
      scale > 1
    ) {
      gestureRef.current.mode =
        "pan";

      gestureRef.current.startPoint = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };

      gestureRef.current.startPosition =
        position;
    }
  }

  function handleWheel(
    event: WheelEvent<HTMLImageElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    const direction =
      event.deltaY > 0
        ? -0.2
        : 0.2;

    const nextScale = Math.min(
      4,
      Math.max(
        1,
        scale + direction
      )
    );

    setScale(nextScale);

    if (nextScale === 1) {
      setPosition({
        x: 0,
        y: 0,
      });
    }
  }

  return (
    <div
      className="viewer"
      onClick={onClose}
    >
      <div className="viewer-backdrop" />

      <button
        className="viewer-close"
        onClick={onClose}
        aria-label="Tutup"
      >
        ×
      </button>

      <div
        className="viewer-content"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="viewer-image-wrap">
          {!loaded && (
            <div className="viewer-loading">
              Memuat...
            </div>
          )}

          <img
            ref={imageRef}
            className={`viewer-image ${
              loaded
                ? "viewer-image-loaded"
                : ""
            }`}
            src={post.image_url}
            alt={
              post.caption ||
              "Gallery image"
            }
            draggable={false}
            onLoad={() =>
              setLoaded(true)
            }
            onTouchStart={
              handleTouchStart
            }
            onTouchMove={
              handleTouchMove
            }
            onTouchEnd={
              handleTouchEnd
            }
            onWheel={handleWheel}
            style={{
              transform:
                `translate3d(${position.x}px, ${position.y}px, 0) ` +
                `scale(${scale})`,
            }}
          />
        </div>

        <div className="viewer-bottom">
          <div className="viewer-caption">
            {post.caption}
          </div>

          <button
            className={`viewer-like ${
              liked ? "liked" : ""
            }`}
            onClick={onLike}
          >
            <span>
              {liked ? "♥" : "♡"}
            </span>
            {post.likes}
          </button>
        </div>
      </div>
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
  const [imageBase64, setImageBase64] =
    useState("");

  const [imageName, setImageName] =
    useState("");

  const [imageMimeType, setImageMimeType] =
    useState("");

  const [caption, setCaption] =
    useState("");

  const [reading, setReading] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  function handleImageChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setReading(true);
    setImageBase64("");
    setImageName(file.name);
    setImageMimeType(
      file.type || "image/jpeg"
    );

    const reader =
      new FileReader();

    reader.onload = () => {
      const result =
        String(reader.result);

      const commaIndex =
        result.indexOf(",");

      if (commaIndex === -1) {
        setImageBase64("");
        setReading(false);

        alert(
          "Format gambar tidak valid."
        );

        return;
      }

      setImageBase64(
        result.substring(
          commaIndex + 1
        )
      );

      setReading(false);
    };

    reader.onerror = () => {
      setImageBase64("");
      setReading(false);

      alert(
        "Gambar tidak bisa dibaca oleh browser."
      );
    };

    reader.readAsDataURL(file);
  }

  async function upload() {
    if (reading) {
      alert(
        "Tunggu gambar selesai dibaca."
      );

      return;
    }

    if (!imageBase64) {
      alert(
        "Pilih gambar terlebih dahulu."
      );

      return;
    }

    try {
      setUploading(true);

      const response =
        await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type":
              "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            action: "upload",
            adminKey: ADMIN_KEY,
            imageBase64,
            mimeType:
              imageMimeType,
            caption,
          }),
        });

      const text =
        await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          "Server mengirim response yang tidak valid."
        );
      }

      if (!data.success) {
        throw new Error(
          data.message ||
            "Server menolak upload."
        );
      }

      alert(
        "Gambar berhasil diupload."
      );

      setImageBase64("");
      setImageName("");
      setImageMimeType("");
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
      console.error(
        "UPLOAD ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? `Upload gagal.\n\n${error.message}`
          : "Upload gagal."
      );

    } finally {
      setUploading(false);
    }
  }

  async function deletePost(
    id: string
  ) {
    const confirmed =
      window.confirm(
        "Hapus gambar ini?"
      );

    if (!confirmed) {
      return;
    }

    try {
      const response =
        await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type":
              "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            action: "delete",
            adminKey: ADMIN_KEY,
            id,
          }),
        });

      const text =
        await response.text();

      const data =
        JSON.parse(text);

      if (data.success) {
        await onRefresh();
      } else {
        alert(
          data.message ||
            "Gagal menghapus."
        );
      }

    } catch (error) {
      console.error(
        "Delete gagal:",
        error
      );

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
          <p>
            Kelola posting gallery
          </p>
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
          <h2>
            Upload gambar
          </h2>

          <label
            className="file-label"
            htmlFor="image-upload"
          >
            {reading
              ? "Membaca gambar..."
              : imageName
                ? imageName
                : "Pilih gambar dari HP"}
          </label>

          <input
            id="image-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={
              handleImageChange
            }
          />

          <textarea
            placeholder="Caption..."
            value={caption}
            onChange={(event) =>
              setCaption(
                event.target.value
              )
            }
          />

          <button
            className="upload-button"
            onClick={upload}
            disabled={
              reading ||
              uploading ||
              !imageBase64
            }
          >
            {reading
              ? "Membaca gambar..."
              : uploading
                ? "Mengupload..."
                : "Upload"}
          </button>
        </section>

        <section className="admin-posts">
          <div className="admin-posts-title">
            <h2>Posting</h2>

            <button
              onClick={onRefresh}
            >
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
                    <p>
                      {post.caption}
                    </p>

                    <small>
                      ♥ {post.likes} · Views{" "}
                      {post.views}
                    </small>
                  </div>

                  <button
                    className="delete-button"
                    onClick={() =>
                      deletePost(
                        post.id
                      )
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

export default App;
