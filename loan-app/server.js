const express=require("express"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const DIR=process.env.DATA_DIR||__dirname,FILE=path.join(DIR,"data.json");
const PIN=process.env.ADMIN_PIN,AP=process.env.ADMIN_PATH;
if(!PIN||PIN.length<6){console.error("Set ADMIN_PIN (6+ characters)");process.exit(1)}
if(!/^[A-Za-z0-9_-]{12,}$/.test(AP||"")){console.error("Set ADMIN_PATH (12+ letters/numbers, e.g. k7x2-mq9v-t4rw)");process.exit(1)}
let S={pool:0,rate:2,max:50000,code:process.env.INVITE_CODE||"friend",loans:[]};
try{S=Object.assign(S,JSON.parse(fs.readFileSync(FILE,"utf8")))}catch{}
const save=()=>{fs.writeFileSync(FILE+".tmp",JSON.stringify(S));fs.renameSync(FILE+".tmp",FILE)};
const eq=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)};
const hits=new Map();
const limited=(k,max,ms)=>{const n=Date.now(),h=(hits.get(k)||[]).filter(t=>n-t<ms);h.push(n);hits.set(k,h);return h.length>max};
const sessions=new Map();
const paid=l=>l.pays.reduce((s,p)=>s+p,0);
const digits=s=>String(s||"").replace(/\D/g,"");
const app=express();app.set("trust proxy",1);app.use(express.json({limit:"10kb"}));
app.use(express.static(path.join(__dirname,"public")));
app.get("/"+AP,(q,r)=>{r.set({"Cache-Control":"no-store","X-Robots-Tag":"noindex"});r.sendFile(path.join(__dirname,"private","admin.html"))});
const bad=(res,m,c=400)=>res.status(c).json({error:m});
app.get("/api/config",(q,r)=>r.json({rate:S.rate,max:S.max}));
app.post("/api/loans",(q,res)=>{
  if(limited("l"+q.ip,10,36e5))return bad(res,"Too many attempts. Try later.",429);
  const b=q.body||{},t=k=>String(b[k]||"").trim().slice(0,60);
  if(!eq(t("code").toLowerCase(),S.code.toLowerCase()))return bad(res,"That invite code is not valid.");
  const phone=digits(b.phone),amount=Math.round(+b.amount),days=+b.days;
  if(!t("name")||!t("bank"))return bad(res,"Please fill in all details.");
  if(phone.length<7||phone.length>15)return bad(res,"Enter a valid phone number.");
  if(!/^\d{10}$/.test(t("acct")))return bad(res,"Account number must be 10 digits.");
  if(![7,14,30,60].includes(days))return bad(res,"Pick a repayment period.");
  if(!(amount>0))return bad(res,"Enter an amount.");
  if(amount>S.max)return bad(res,"Maximum per loan is ₦"+S.max.toLocaleString("en-NG")+".");
  if(S.loans.some(l=>l.phone===phone&&["pending","active"].includes(l.status)))return bad(res,"You already have an open loan. Clear it first.");
  const reserved=S.loans.filter(l=>l.status==="pending").reduce((s,l)=>s+l.amount,0);
  if(amount>S.pool-reserved)return bad(res,"Not enough available right now. Try a smaller amount.");
  const total=Math.round(amount+amount*S.rate/100*days/30);
  const l={id:Date.now(),name:t("name"),phone,bank:t("bank"),acct:t("acct"),amount,total,days,due:Date.now()+days*864e5,status:"pending",pays:[]};
  S.loans.push(l);save();res.json({total:l.total,due:l.due});
});
app.post("/api/check",(q,res)=>{
  if(limited("c"+q.ip,20,36e5))return bad(res,"Too many attempts. Try later.",429);
  const b=q.body||{};
  if(!eq(String(b.code||"").trim().toLowerCase(),S.code.toLowerCase()))return bad(res,"That invite code is not valid.");
  const p=digits(b.phone);
  res.json({loans:S.loans.filter(l=>p&&l.phone===p).map(l=>({amount:l.amount,total:l.total,due:l.due,status:l.status,paid:paid(l)}))});
});
app.post("/api/admin/login",(q,res)=>{
  if(limited("a"+q.ip,5,9e5))return bad(res,"Too many attempts. Wait 15 minutes.",429);
  if(!eq((q.body||{}).pin||"",PIN))return bad(res,"Wrong PIN.",401);
  const t=crypto.randomBytes(24).toString("hex");sessions.set(t,Date.now()+432e5);res.json({token:t});
});
const auth=(q,res,next)=>{const t=(q.headers.authorization||"").slice(7),e=sessions.get(t);
  if(!e||e<Date.now())return bad(res,"Session expired. Log in again.",401);next()};
app.get("/api/admin/state",auth,(q,r)=>r.json({pool:S.pool,rate:S.rate,max:S.max,code:S.code,loans:S.loans.map(l=>({...l,paid:paid(l)}))}));
app.post("/api/admin/settings",auth,(q,res)=>{
  const b=q.body||{};
  if(!(b.pool>=0)||!(b.rate>=0)||!(b.max>0)||!String(b.code||"").trim())return bad(res,"Check your settings values.");
  S.pool=+b.pool;S.rate=+b.rate;S.max=+b.max;S.code=String(b.code).trim().slice(0,40);save();res.json({ok:1});
});
app.post("/api/admin/loans/:id/:act",auth,(q,res)=>{
  const l=S.loans.find(x=>x.id===+q.params.id),a=q.params.act;
  if(!l)return bad(res,"Loan not found.",404);
  if(a==="send"){if(l.status!=="pending")return bad(res,"Not pending.");if(l.amount>S.pool)return bad(res,"Pool is too low for this loan.");
    S.pool-=l.amount;l.status="active";l.due=Date.now()+l.days*864e5}
  else if(a==="decline"){if(l.status!=="pending")return bad(res,"Not pending.");l.status="declined"}
  else if(a==="pay"){const n=+(q.body||{}).amount;if(l.status!=="active"||!(n>0))return bad(res,"Cannot record that repayment.");
    l.pays.push(n);S.pool+=n;if(paid(l)>=l.total)l.status="repaid"}
  else return bad(res,"Unknown action.",404);
  save();res.json({ok:1});
});
app.listen(process.env.PORT||3000,()=>console.log("Loan Desk running"));
