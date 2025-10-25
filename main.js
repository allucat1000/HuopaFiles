let auth;
const loginDiv = document.getElementById("login");
const linkButton = document.getElementById("linkAccount");
const servUrl = document.getElementById("serverURL");
const authInput = document.getElementById("authKey");
const error = document.getElementById("error");
const mainDiv = document.getElementById("mainUI")
function login() {
    loginDiv.classList.remove("hidden");
    linkButton.onclick = async() => {
        error.classList.add("hidden")
        if (!servUrl.value.trim() || !authInput.value.trim()) {
            error.textContent = "You need to fill both fields!";
            error.classList.remove("hidden");
            return;
        }
        let res;
        try {
            res = await fetch((servUrl.value.endsWith("/") ? servUrl.value : servUrl.value + "/") + `authCheck?auth=${authInput.value}`);
        }
        catch {
            res = { ok: false };
        }
        if (res.ok) {
            localStorage.setItem("auth", authInput.value);
            localStorage.setItem("url", (servUrl.value.endsWith("/") ? servUrl.value : servUrl.value + "/"));
            window.location.reload()
        } else {
            error.textContent = "Failed to authenticate. Check if the auth key and url are correct.";
            error.classList.remove("hidden");
        }
    }
}
(async () => {
try {
    await navigator.storage.persist()
} catch {}
if (localStorage.getItem("auth") && localStorage.getItem("url")) {
    let res;
    try {
        res = await fetch(localStorage.getItem("url") + `authCheck?auth=${localStorage.getItem("auth")}`);
    }
    catch {
        res = { ok: false };
    }
    if (!res.ok) {
        if (res.status == 429) return;
        localStorage.removeItem("auth");
        localStorage.removeItem("url");
        window.location.reload();
    } else {
        auth = localStorage.getItem("auth");
        mainDiv.classList.remove("hidden");
        main()
    }
} else {
    login()
}
})()

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + "b";
  const units = ["kb", "mb", "gb", "tb"];
  let i = -1;
  do {
    bytes /= 1024;
    i++;
  } while (bytes >= 1024 && i < units.length - 1);
  return bytes.toFixed(bytes < 10 && i > 0 ? 1 : 0) + units[i];
}

function isBase64(str) {
  return /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(str);
}

async function isBase64Image(base64) {
  if (!isBase64(base64)) return false;

  try {
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);

    const blob = new Blob([array]);
    return blob.type.startsWith("image/")
  } catch {
    return false;
  }
}

async function main() {
    const url = localStorage.getItem("url");
    const pageUrl = new URL(window.location.href);
    let currentDir = pageUrl.searchParams.get("path") ? pageUrl.searchParams.get("path") : "/";
    document.getElementById("error")?.remove();
    const dirPath = document.getElementById("path");
    document.title = `${currentDir} — Huopa Files`
    dirPath.textContent = currentDir
    const fileDiv = document.getElementById("files");
    const uploadEl = document.getElementById("upload");
    const uploadButton = document.getElementById("uploadButton");
    const deleteButton = document.getElementById("deleteButton");
    if (currentDir === "/") deleteButton.style.display = "none"; else deleteButton.style.display = "block";
    deleteButton.onclick = async () => {
        const urlPath = url + `${currentDir.slice(1)}?auth=${auth}`;
        await fetch(urlPath, {
            method: "DELETE",
        });
        let winUrl = new URL(window.location.href);
        const parent = (winUrl.searchParams.get("path")).split("/").slice(0, -1).join("/");
        winUrl.searchParams.set("path", parent);
        window.location.href = winUrl.toString();
    }
    uploadEl.addEventListener("change", async () => {
        if (uploadEl.files.length === 0) return;

        const file = uploadEl.files[0];
        let val = prompt("Choose filename", file.name.replaceAll(" ", ""));
        if (!val) return;
        val = val.replaceAll(" ", "");

        const parts = val.split("/").filter(Boolean);
        if (parts.length === 0) return;
        const filename = parts[parts.length - 1];
        const folders = parts.slice(0, -1);

        const currentDirPath = currentDir === "/" ? "" : currentDir;
        const baseServer = url.endsWith("/") ? url.slice(0, -1) : url; 
        const dirBase = currentDirPath === "/" || currentDirPath === "" ? "" : currentDirPath;

        let accumulated = dirBase;
        for (const folder of folders) {
            accumulated = accumulated + "/" + encodeURIComponent(folder);

            const fullUrl = `${baseServer}${accumulated}?auth=${encodeURIComponent(auth)}`;

            const headRes = await fetch(fullUrl, { method: "GET" });
            if (headRes.status === 404) {
            const createRes = await fetch(fullUrl, {
                method: "POST",
                headers: {
                "Content-Type": "application/json",
                "type": "dir"
                },
                body: JSON.stringify([])
            });
            if (!createRes.ok) {
                console.error(`Failed to create directory: ${accumulated} (${createRes.status})`);
                return;
            }
            } else if (!headRes.ok && headRes.status !== 404) {
            console.error(`Error checking directory: ${accumulated} (${headRes.status})`);
            return;
            }
        }

        const filePath = `${dirBase}/${parts.map(p => encodeURIComponent(p)).join("/")}`.replace(/\/+/g, "/");
        const uploadUrl = `${baseServer}${filePath}?auth=${encodeURIComponent(auth)}`;

        const isText = file.type.startsWith("text/") || file.type === "" || file.type === "application/json";

        let body;
        if (isText) {
            body = await file.text();
        } else {
            body = await file.arrayBuffer();
        }

        const uploadRes = await fetch(uploadUrl, {
            method: "POST",
            headers: {
            "type": "file",
            "Content-Type": file.type || (isText ? "text/plain" : "application/octet-stream")
            },
            body
        });

        if (!uploadRes.ok) {
            console.error(`Upload failed: ${uploadRes.status}`, await uploadRes.text());
        } else {
            console.log("Upload successful:", filePath);
        }
        });


    async function loadFiles() {
        const res = await fetch(url + currentDir.slice(1) + `?auth=${auth}`);
        let file = await res.text()
        if (!res.ok) {
            if (currentDir == "/") {
                await fetch(url + `?auth=${auth}`, {
                    method: "POST",
                    headers: {
                        "type": "dir"
                    },
                    body: "[]"
                });
                await fetch(url + `Welcome.txt?auth=${auth}`, {
                    method: "POST",
                    headers: {
                        "type": "file"
                    },
                    body: "Hello! This is a cloud storage frontend and backend. Bleh"
                })
                return loadFiles();
            }
            const error = document.createElement("h3");
            error.id = "error";
            if (res.status == 404) {
                error.textContent = "The directory/file you are viewing doesn't seem to exist.";
                error.classList.add("dirError");
                mainDiv.insertBefore(error, fileDiv)
                document.getElementById("loadingSpinner")?.remove()
            }
        } else {
            let dir = false;
            try {
                dir = JSON.parse(file).type == "dir";
            } catch {}
            if (!dir) uploadButton.style.display = "none";
            document.getElementById("loadingSpinner")?.remove()
            if (dir) {
                const files = JSON.parse(file).content
                for (const file of files) {
                    const div = document.createElement("div");
                    div.classList.add("file");
                    const name = document.createElement("p");
                    name.classList.add("filename")
                    name.textContent = file.filename.split("/").pop();
                    div.append(name);
                    const fileIcon = document.createElement("img");
                    let fileIconSrc;
                    if (file.type == "file") {
                        fileIconSrc = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-icon lucide-file"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`;
                    } else {
                        fileIconSrc = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder-icon lucide-folder"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
                    }
                    fileIcon.src = `data:image/svg+xml;utf8,${fileIconSrc}`;
                    fileIcon.classList.add("fileicon");
                    const fileSize = document.createElement("p");
                    fileSize.textContent = formatBytes(file.size)
                    fileSize.classList.add("fileinfo");
                    div.append(fileIcon);
                    if (file.type !== "dir")
                    div.append(fileSize);
                    fileDiv.append(div);
                    div.addEventListener("mouseenter", () => {
                        div.classList.add("filehovered");
                    })
                    div.onclick = () => {
                        let url = new URL(window.location.href);
                        url.searchParams.set("path", file.filename);
                        window.location.href = url.toString();
                    }
                    div.addEventListener("mouseleave", () => {
                        div.classList.remove("filehovered");
                    })
                }
            } else {
                fileDiv.style.display = "block"
                file = JSON.parse(file)
                const ct = file?.contenttype;
                if (ct.includes("text/")) {
                    const text = document.createElement("textarea");
                    text.value = atob(file.content);
                    text.addEventListener("keydown", async(e) => {
                        if (e.key.toLowerCase() == "s") {
                            if ((navigator.platform == "MacIntel" && e.metaKey) || (navigator.platform !== "MacIntel" && e.ctrlKey)) {
                                e.preventDefault()
                                await fetch(url + `${file.filename.slice(1)}?auth=${auth}`, {
                                    method: "POST",
                                    headers: {
                                        "type": "file"
                                    },
                                    body: text.value
                                });
                            }
                        }
                    })
                    text.classList.add("textFileInput");
                    fileDiv.append(text);
                } else if (ct.includes("image/")) {
                    const img = document.createElement("img");
                    img.src = `data:${ct};base64,${file.content}`;
                    img.classList.add("imageFileEl");
                    fileDiv.append(img);
                } else if (ct.includes("video/")) {
                    const vid = document.createElement("video");
                    vid.src = `data:${ct};base64,${file.content}`;
                    vid.controls = true;
                    vid.classList.add("videoFileEl");
                    fileDiv.append(vid);
                }
            }
        }
    }
    loadFiles()
}