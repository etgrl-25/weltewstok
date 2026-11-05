const $ = (s) => document.querySelector(s);
const money = n => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(Number(n) || 0);
const number = n => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(Number(n) || 0);
const escapeHtml = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let products = [];
async function api(path, options={}) { const r=await fetch(path,{...options,headers:{"content-type":"application/json",...(options.headers||{})}}); const body=await r.json().catch(()=>({})); if(!r.ok) throw new Error(body.error||`İşlem tamamlanmadı (${r.status})`); return body; }
function toast(s){const t=$("#toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
async function load(){try{products=await api("/api/products");render()}catch(e){$("#desc").textContent=e.message;toast(e.message)}}
function render(){
  const q=$("#search").value.trim().toLocaleLowerCase("tr"), cat=$("#category").value;
  const categories=[...new Set(products.map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr"));
  const prior=cat; $("#category").innerHTML='<option value="">Tüm kategoriler</option>'+categories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join(""); $("#category").value=categories.includes(prior)?prior:"";
  const visible=products.filter(p=>(!q||`${p.name} ${p.sku} ${p.barcode||""}`.toLocaleLowerCase("tr").includes(q))&&(!cat||p.category===cat));
  $("#count").textContent=number(products.length); $("#quantity").textContent=number(products.reduce((a,p)=>a+(Number(p.qty)||0),0));
  $("#value").textContent=money(products.reduce((a,p)=>a+(Number(p.qty)||0)*(Number(p.buy)||0),0)); $("#empty").textContent=number(products.filter(p=>(Number(p.qty)||0)===0).length);
  $("#desc").textContent=`${number(visible.length)} ürün gösteriliyor`; $("#emptyState").hidden=visible.length>0;
  $("#rows").innerHTML=visible.map(p=>`<tr><td>${escapeHtml(p.name)}<div class="sub">${escapeHtml(p.warehouse||"")}</div></td><td class="code">${escapeHtml(p.sku)}</td><td>${escapeHtml(p.category||"—")}</td><td>${escapeHtml(p.warehouse||"—")}</td><td class="qty ${(Number(p.qty)||0)===0?"low":"ok"}">${number(p.qty)} ${escapeHtml(p.unit||"adet")}</td><td class="money">${money(p.buy)}</td><td><div class="row-actions"><button data-move="${escapeHtml(p.id)}" title="Stok giriş/çıkış">±</button><button data-edit="${escapeHtml(p.id)}" title="Düzenle">✎</button><button data-delete="${escapeHtml(p.id)}" title="Sil">⌫</button></div></td></tr>`).join("");
}
$("#search").addEventListener("input",render); $("#category").addEventListener("change",render);
$("#addBtn").addEventListener("click",()=>openForm()); $("#closeForm").addEventListener("click",()=>$("#formDialog").close()); $("#cancelForm").addEventListener("click",()=>$("#formDialog").close());
function openForm(p){const f=$("#productForm");f.reset();f.elements.id.value=p?.id||"";f.elements.name.value=p?.name||"";f.elements.sku.value=p?.sku||"";f.elements.category.value=p?.category||"";f.elements.qty.value=p?.qty??0;f.elements.unit.value=p?.unit||"adet";f.elements.buy.value=p?.buy??0;f.elements.min.value=p?.min??0;f.elements.warehouse.value=p?.warehouse||"";$("#formTitle").textContent=p?"Ürünü düzenle":"Ürün ekle";$("#formDialog").showModal()}
$("#productForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,id=f.elements.id.value,old=products.find(p=>p.id===id)||{};const p={...old,id:id||undefined,name:f.elements.name.value,sku:f.elements.sku.value,category:f.elements.category.value,qty:Number(f.elements.qty.value)||0,unit:f.elements.unit.value||"adet",buy:Number(f.elements.buy.value)||0,sell:Number(old.sell)||0,min:Number(f.elements.min.value)||0,warehouse:f.elements.warehouse.value};try{await api("/api/products",{method:"POST",body:JSON.stringify(p)});$("#formDialog").close();toast("Ürün kaydedildi");await load()}catch(err){toast(err.message)}});
$("#rows").addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;const id=b.dataset.edit||b.dataset.delete||b.dataset.move,p=products.find(x=>x.id===id);if(!p)return;
 if(b.dataset.edit){openForm(p);return} if(b.dataset.delete){if(!confirm(`${p.name} silinsin mi?`))return;try{await api(`/api/products/${encodeURIComponent(id)}`,{method:"DELETE"});toast("Ürün silindi");await load()}catch(err){toast(err.message)}return}
 const type=prompt("İşlem türü: giris / cikis / duzeltme","giris");if(!["giris","cikis","duzeltme"].includes(type))return;const amount=Number(prompt(type==="duzeltme"?"Yeni sayım miktarı":"İşlem miktarı","1"));if(!Number.isFinite(amount)||amount<0)return;const note=prompt("Açıklama (isteğe bağlı)","")||"";try{await api("/api/movements",{method:"POST",body:JSON.stringify({productId:id,type,qty:amount,note})});toast("Stok hareketi kaydedildi");await load()}catch(err){toast(err.message)}
});
$("#importBtn").addEventListener("click",()=>$("#file").click());
$("#file").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const records=JSON.parse(await file.text());if(!Array.isArray(records))throw new Error("JSON dosyasında ürün listesi bulunamadı");const result=await api("/api/import",{method:"POST",body:JSON.stringify(records)});toast(`${number(result.imported)} ürün aktarıldı`);await load()}catch(err){toast(err.message)}finally{e.target.value=""}});
load();
