const messagesEl=document.getElementById("messages");
const input=document.getElementById("messageInput");
const form=document.getElementById("chatForm");
const clearBtn=document.getElementById("clearBtn");
let conversation=[];

function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function addMessage(text,type){
  const row=document.createElement("div"); row.className="message-row "+type;
  row.innerHTML=type==="user"
    ? `<div class="bubble">${escapeHtml(text)}</div><div class="msg-avatar">U</div>`
    : `<div class="msg-avatar">✦</div><div class="bubble">${escapeHtml(text)}</div>`;
  messagesEl.appendChild(row); messagesEl.scrollTop=messagesEl.scrollHeight; return row;
}
function typingRow(){
  const row=document.createElement("div");row.className="message-row";
  row.innerHTML='<div class="msg-avatar">✦</div><div class="bubble typing"><span></span><span></span><span></span></div>';
  messagesEl.appendChild(row);messagesEl.scrollTop=messagesEl.scrollHeight;return row;
}
async function send(text){
  text=text.trim(); if(!text)return;
  document.getElementById("welcome")?.remove();
  addMessage(text,"user");
  conversation.push({role:"user",content:text});
  input.value=""; input.disabled=true;
  const loading=typingRow();
  try{
    const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:conversation})});
    const data=await res.json();
    loading.remove();
    if(!res.ok) throw new Error(data.error||"Request failed");
    addMessage(data.reply,"ai");
    conversation.push({role:"assistant",content:data.reply});
  }catch(err){
    loading.remove();
    addMessage("⚠️ "+err.message,"ai");
  }finally{input.disabled=false;input.focus();}
}
form.addEventListener("submit",e=>{e.preventDefault();send(input.value);});
document.querySelectorAll(".suggestions button").forEach(b=>b.addEventListener("click",()=>send(b.dataset.prompt)));
document.getElementById("newChat").addEventListener("click",()=>location.reload());
clearBtn.addEventListener("click",()=>{conversation=[];messagesEl.innerHTML=`<div class="welcome" id="welcome"><div class="big-logo">✦</div><h1>How can I help you today?</h1><p>Ask anything — ADITYA'S AI is powered by Groq.</p><div class="suggestions"><button data-prompt="Explain HTML in simple words">💡 Explain HTML simply</button><button data-prompt="Give me 5 website project ideas">🚀 Give me project ideas</button><button data-prompt="Write a simple CSS card">💻 Write CSS code</button><button data-prompt="Help me learn JavaScript">📚 Help me learn JS</button></div></div>`;document.querySelectorAll(".suggestions button").forEach(b=>b.addEventListener("click",()=>send(b.dataset.prompt)));});
document.getElementById("themeBtn").addEventListener("click",()=>document.body.classList.toggle("light"));
