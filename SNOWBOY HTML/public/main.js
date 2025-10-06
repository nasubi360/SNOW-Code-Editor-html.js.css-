const socket = io();
const roomId = "default";
let editor, currentTab="html";
const preview = document.getElementById("preview");
const usersDiv = document.getElementById("users");
const codeData = { html:"", css:"", js:"" };

socket.emit("joinRoom", roomId);

const usernameInput = document.getElementById("username");
document.getElementById("changeName").onclick = () => {
  socket.emit("setName", usernameInput.value);
};

// CodeMirror 5 初期化
editor = CodeMirror(document.getElementById("editor-container"), {
  value:"",
  lineNumbers:true,
  mode:"htmlmixed",
  theme:"default"
});

// タブ切替
document.querySelectorAll("#tabs button").forEach(btn=>{
  btn.onclick=()=>{
    saveCurrentTab();
    currentTab = btn.dataset.tab;
    loadCurrentTab();
  }
});

function saveCurrentTab(){ codeData[currentTab] = editor.getValue(); }
function loadCurrentTab(){
  editor.setValue(codeData[currentTab]);
  if(currentTab==="html") editor.setOption("mode","htmlmixed");
  else if(currentTab==="css") editor.setOption("mode","css");
  else if(currentTab==="js") editor.setOption("mode","javascript");
  editor.focus();
  updatePreview();
}

// 画像インポート
document.addEventListener("keydown",(e)=>{
  if(e.ctrlKey && e.key==="i") document.getElementById("imgImport").click();
});
document.getElementById("imgImport").addEventListener("change", async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const base64 = await fileToBase64(file);
  editor.replaceSelection(`<img src="${base64}">`);
});
function fileToBase64(file){
  return new Promise(r=>{
    const reader = new FileReader();
    reader.onload = ()=>r(reader.result);
    reader.readAsDataURL(file);
  });
}

// リアルタイム編集
editor.on("change", ()=>{
  saveCurrentTab();
  socket.emit("codeUpdate", codeData);
  updatePreview();
});

// サーバーイベント
socket.on("initCode",(data)=>{ Object.assign(codeData,data); loadCurrentTab(); });
socket.on("codeUpdate",(data)=>{ Object.assign(codeData,data); loadCurrentTab(); });
socket.on("updateUsers",(list)=>{ usersDiv.textContent = "👥 参加者: "+list.join(", "); });

// プレビュー更新
function updatePreview(){
  preview.srcdoc = `<style>${codeData.css}</style>${codeData.html}<script>${codeData.js}<\/script>`;
}

// 保存ボタン
document.getElementById("saveBtn").onclick = async ()=>{
  await fetch(`/save/${roomId}`,{
    method:"POST",
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(codeData)
  });
  alert("保存しました！");
};
