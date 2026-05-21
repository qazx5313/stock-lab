/* ============ 初始資料容器 ============
   注意：正式畫面會等 Supabase 載入成功才顯示資料頁；載入失敗時不渲染下列舊占位資料。 */
const DATA = {
  meta:{date:'載入中',weekday:'',updated:'—'},
  realtimeMap:{},
  maintenance:{},
  observations:[],
  atrWatch:[],
  onlineCount:0,
  onlineStats:{members:0,guests:0,total:0},

  market:{
    twse:{name:'加權指數',v:21684.32,d:+182.45,dp:+0.85},
    tpex:{name:'櫃買指數',v:248.91,d:+3.12,dp:+1.27},
    txFut:{name:'台指期',v:null,d:null,dp:null},
    txfCharts:{day:{points:[]},night:{points:[]}},
    amtTwse:'3,842 億', amtTpex:'986 億', amtTotal:'4,828 億',
    up:842, down:651, limitUp:31, limitDown:4,
    flat:90,
    twseDist:{up:520,down:380,flat:45,limitUp:18,limitDown:2,amount:384200000000,count:945},
    tpexDist:{up:322,down:271,flat:45,limitUp:13,limitDown:2,amount:98600000000,count:638},
    status:'偏多震盪',
    statusNote:'指數收紅、量能略增，資金集中 PCB、玻纖布、面板與 AI 伺服器族群。'
  },

  themes:[
    {id:'glassfiber',name:'玻纖布',score:92,gain:'+4.8%',vol:'2.4x',limit:5,high:9,status:'主流',
     desc:'AI 伺服器高速板需求帶動 Low-Dk 玻纖布，產業鏈缺貨漲價題材延燒。',chain:'中游材料'},
    {id:'pcb',name:'PCB / CCL',score:88,gain:'+3.6%',vol:'1.9x',limit:3,high:7,status:'強勢延伸',
     desc:'高多層板、HDI 受惠 AI 伺服器與交換器升級，CCL 跟漲。',chain:'中下游製造'},
    {id:'panel',name:'面板',score:76,gain:'+2.9%',vol:'1.7x',limit:2,high:4,status:'低位階補漲',
     desc:'低基期、報價落底回升，類股輪動補漲。',chain:'下游製造'},
    {id:'aiserver',name:'AI 伺服器',score:74,gain:'+1.8%',vol:'1.3x',limit:1,high:3,status:'長線主流',
     desc:'GB 系列拉貨延續，長線需求明確但短線位階偏高。',chain:'下游系統'},
    {id:'power',name:'重電',score:69,gain:'+2.1%',vol:'1.4x',limit:1,high:2,status:'輪動題材',
     desc:'電網升級與資料中心用電，輪動買盤介入。',chain:'設備'},
    {id:'glasssub',name:'玻璃基板',score:64,gain:'+1.5%',vol:'1.2x',limit:0,high:1,status:'觀察',
     desc:'先進封裝玻璃基板，題材長線、短線量能不足。',chain:'上游材料'},
    {id:'cooling',name:'散熱',score:61,gain:'+1.1%',vol:'1.1x',limit:0,high:1,status:'觀察',
     desc:'液冷滲透率提升，等待領漲股表態。',chain:'零組件'},
    {id:'robot',name:'機器人',score:58,gain:'+0.9%',vol:'1.0x',limit:0,high:0,status:'降溫',
     desc:'人形機器人題材短線退燒，等量縮整理。',chain:'系統'},
  ],

  themeList:['AI 伺服器','PCB / CCL','玻纖布','玻璃基板','面板','散熱','重電','機器人',
    '低軌衛星','矽光子','記憶體','半導體設備','軍工','電動車','充電樁','石英材料','黃金 / 貴金屬'],

  // PCB / CCL / 玻纖布 產業鏈
  chain:{
    title:'PCB / CCL / 玻纖布 產業鏈',
    levels:[
      {label:'上游 · 玻纖紗',stocks:[{c:'1802',n:'台玻'}]},
      {label:'中游 · 玻纖布',stocks:[{c:'1815',n:'富喬'},{c:'5340',n:'建榮'}]},
      {label:'CCL · 銅箔基板',stocks:[{c:'6274',n:'台燿'},{c:'2383',n:'台光電'},{c:'6213',n:'聯茂'}]},
      {label:'PCB 製造',stocks:[{c:'2368',n:'金像電'},{c:'3044',n:'健鼎'},{c:'3037',n:'欣興'},{c:'4958',n:'臻鼎'}]},
      {label:'AI 伺服器',stocks:[{c:'2382',n:'廣達'},{c:'6669',n:'緯穎'},{c:'3231',n:'緯創'}]},
    ]
  },

  picks:[
    {c:'1815',n:'富喬',t:'玻纖布',px:38.65,dp:+9.92,vol:'48,210',ts:88,cs:82,ms:95,fs:90,
     ai:'站上 20MA 放量攻漲停，法人連三買，題材主流，留意是否帶量過前高。'},
    {c:'6274',n:'台燿',t:'CCL',px:285.0,dp:+6.34,vol:'12,840',ts:85,cs:79,ms:90,fs:86,
     ai:'CCL 龍頭跟漲，量增價揚，外資投信同步偏多。'},
    {c:'2368',n:'金像電',t:'PCB',px:312.5,dp:+5.21,vol:'9,560',ts:81,cs:84,ms:88,fs:84,
     ai:'AI 伺服器板受惠股，突破近 20 日高，籌碼集中。'},
    {c:'5340',n:'建榮',t:'玻纖布',px:46.20,dp:+7.45,vol:'15,330',ts:79,cs:71,ms:92,fs:80,
     ai:'玻纖布補漲股，今日帶量突破整理區，續強需法人接手。'},
    {c:'2383',n:'台光電',t:'CCL',px:498.0,dp:+3.12,vol:'6,210',ts:77,cs:75,ms:85,fs:78,
     ai:'高階 CCL，趨勢偏多但位階偏高，可等回測均線。'},
    {c:'3037',n:'欣興',t:'PCB',px:168.5,dp:+2.74,vol:'21,450',ts:72,cs:68,ms:80,fs:73,
     ai:'ABF 載板，量能穩定，屬於延伸補漲。'},
  ],

  news:[
    {c:'1815',n:'富喬',title:'富喬泰國新廠設備到位，預計 2027 Q3 量產',time:'14:08',k:'good'},
    {c:'6274',n:'台燿',title:'台燿 4 月營收月增 18%，AI 板需求強',time:'13:52',k:'good'},
    {c:'2382',n:'廣達',title:'廣達法說：AI 伺服器營收占比續升',time:'11:30',k:'good'},
    {c:'3037',n:'欣興',title:'外資調降欣興目標價，籌碼面待觀察',time:'10:15',k:'bad'},
    {c:'-',n:'盤勢',title:'台股量增收紅，三大法人合計買超 142 億',time:'15:40',k:'neu'},
  ],

  risks:[
    {c:'8155',n:'博智',type:'處置股',note:'連續異常波動，分盤交易'},
    {c:'3661',n:'世芯-KY',type:'注意股',note:'本益比偏高，列注意'},
    {c:'2618',n:'長榮航',type:'爆量不漲',note:'量增價平，賣壓浮現'},
    {c:'2330',n:'台積電',type:'高檔長上影',note:'高檔長上影線，留意短壓'},
    {c:'2454',n:'聯發科',type:'法人賣超',note:'外資連 3 日賣超'},
  ],

  // 個股分析示範（富喬 1815）
  stock:{
    c:'1815',n:'富喬',market:'上市',industry:'玻璃玻纖',theme:'玻纖布',role:'中游材料 · 補漲龍頭',
    px:38.65,dp:+9.92,vol:'48,210',high:38.65,low:35.10,open:35.20,
    inst:{foreign:'+12,480',trust:'+3,210',dealer:'+820',total:'+16,510'},
    margin:{mb:'18,420 張',sb:'1,205 張',mc:'-340',sc:'+88'},
    inst3:'外資近3日 +28,900 · 投信 +7,400 · 合計 +39,100',
    trend:'偏多', tStat:'站上 5/10/20/60MA，多頭排列', cStat:'法人連續 3 日買超，籌碼集中',
    mStat:'玻纖布主流題材，熱度 92', riskStat:'股價單日 +9.92% 接近漲停，留意追高風險',
    op:'觀察是否帶量突破前波高 39.8，回測 20MA 不破續抱。',
    ann:[
      {d:'05/16',t:'富喬泰國新廠設備到位，2027 Q3 量產'},
      {d:'05/10',t:'4 月營收 7.2 億，月增 12%、年增 24%'},
      {d:'04/28',t:'董事會通過股利政策，現金股利 1.2 元'},
    ]
  },

  // 每日篩選預設結果
  screen:[
    {c:'1815',n:'富喬',t:'玻纖布',px:38.65,dp:+9.92,vol:'48,210',ts:88,cs:82,ms:95,total:90},
    {c:'5340',n:'建榮',t:'玻纖布',px:46.20,dp:+7.45,vol:'15,330',ts:79,cs:71,ms:92,total:81},
    {c:'6274',n:'台燿',t:'CCL',px:285.0,dp:+6.34,vol:'12,840',ts:85,cs:79,ms:90,total:85},
    {c:'2368',n:'金像電',t:'PCB',px:312.5,dp:+5.21,vol:'9,560',ts:81,cs:84,ms:88,total:84},
    {c:'2383',n:'台光電',t:'CCL',px:498.0,dp:+3.12,vol:'6,210',ts:77,cs:75,ms:85,total:79},
    {c:'3037',n:'欣興',t:'PCB',px:168.5,dp:+2.74,vol:'21,450',ts:72,cs:68,ms:80,total:73},
    {c:'2382',n:'廣達',t:'AI 伺服器',px:298.0,dp:+1.82,vol:'18,920',ts:70,cs:66,ms:78,total:71},
    {c:'3231',n:'緯創',t:'AI 伺服器',px:118.5,dp:+1.50,vol:'32,110',ts:68,cs:64,ms:76,total:69},
  ],

  filters:{
    '價格':['股價 > 20','股價 > 50','股價 > 100','股價 > 150','今日漲幅 > 3%','今日漲幅 > 5%'],
    '量能':['成交量 > 3000 張','成交量 > 5000 張','成交量 > 10000 張','量 > 5日均量 1.5倍','量 > 20日均量 2倍'],
    '技術':['站上 5MA','站上 10MA','站上 20MA','5MA 上穿 20MA','KD 黃金交叉','MACD 翻紅','RSI > 50','突破近 20 日高','近月有漲停','漲停 K 附近整理'],
    '籌碼':['外資今日買超','外資近 3 日買超','投信今日買超','投信近 3 日買超','三大法人合計買超','融資減少','融券增加'],
    '題材':['今日強勢題材','AI 題材','PCB 題材','面板題材','低位階補漲'],
  },

  agents:[
    {id:'theme',name:'題材量化 AI',type:'題材動能策略',pre:42,passed:11,buy:3,wr:'62%',pos:5,
     cum:'+18.4%',mon:'+6.2%',win:'58%',mdd:'-9.1%',ver:'v1.4',status:'運行中',
     init:1000000,cash:382000,hold:801000,
     desc:'追蹤新聞題材、重大訊息、產業熱度、量能放大與股價突破，以歷史相似題材回測決定進場。'},
    {id:'tech',name:'技術突破 AI',type:'技術突破策略',pre:55,passed:14,buy:4,wr:'59%',pos:6,
     cum:'+22.7%',mon:'+4.8%',win:'55%',mdd:'-11.4%',ver:'v2.1',status:'運行中',
     init:1000000,cash:295000,hold:932000,
     desc:'均線多頭排列、MACD 翻紅、KD 黃金交叉、RSI 轉強、突破 20 日高，回測歷史突破成功率。'},
    {id:'fund',name:'成長基本面 AI',type:'基本面成長策略',pre:28,passed:8,buy:2,wr:'66%',pos:4,
     cum:'+14.1%',mon:'+3.1%',win:'63%',mdd:'-6.8%',ver:'v1.2',status:'運行中',
     init:1000000,cash:521000,hold:620000,
     desc:'月營收連續成長、EPS 成長、毛利率改善、法人偏買，搭配歷史基本面成長後股價表現。'},
  ],

  aiCand:[
    {c:'1815',n:'富喬',src:'每日篩選',reason:'玻纖布主流 + 漲停 + 法人連買',score:90},
    {c:'6274',n:'台燿',src:'技術篩選',reason:'突破近 20 日高 + 量增',score:85},
    {c:'2368',n:'金像電',src:'產業地圖',reason:'PCB 強勢延伸 + 籌碼集中',score:84},
    {c:'5340',n:'建榮',src:'MOPS 重大訊息',reason:'營收年增 + 玻纖布補漲',score:80},
  ],
  aiBack:[
    {c:'1815',n:'富喬',cond:'站上20MA+法人連買+題材熱',s:38,wr:'71%',ar:'+6.4%',r3:'+3.1%',r5:'+5.2%',r10:'+8.8%',mdd:'-7%',pf:'2.3',res:'通過'},
    {c:'6274',n:'台燿',cond:'突破20日高+量增',s:26,wr:'64%',ar:'+4.8%',r3:'+2.4%',r5:'+3.9%',r10:'+5.6%',mdd:'-9%',pf:'1.9',res:'通過'},
    {c:'2368',n:'金像電',cond:'多頭排列+籌碼集中',s:31,wr:'58%',ar:'+3.2%',r3:'+1.8%',r5:'+2.9%',r10:'+3.4%',mdd:'-11%',pf:'1.5',res:'觀察'},
    {c:'5340',n:'建榮',cond:'營收年增+補漲',s:14,wr:'50%',ar:'+1.1%',r3:'+0.6%',r5:'+0.9%',r10:'-0.8%',mdd:'-13%',pf:'0.9',res:'不通過'},
  ],
  aiPos:[
    {c:'1815',n:'富喬',bp:34.10,cp:38.65,q:30,reason:'玻纖布主流，回測勝率71%'},
    {c:'6274',n:'台燿',bp:262.0,cp:285.0,q:4,reason:'CCL 突破，量能放大'},
    {c:'2368',n:'金像電',bp:298.5,cp:312.5,q:3,reason:'PCB 多頭排列'},
    {c:'2383',n:'台光電',bp:470.0,cp:498.0,q:2,reason:'高階 CCL 法人偏多'},
    {c:'3037',n:'欣興',bp:172.0,cp:168.5,q:6,reason:'ABF 載板補漲（停損觀察）'},
  ],
  aiBuy:[
    {d:'05/14',c:'1815',n:'富喬',p:34.10,q:30,s:88,reason:'站上20MA放量+法人連買',tech:'多頭排列',theme:'玻纖布升溫',chip:'外資連2買',risk:'量增需持續'},
    {d:'05/13',c:'6274',n:'台燿',p:262.0,q:4,s:85,reason:'突破近20日高',tech:'MACD翻紅',theme:'CCL強勢',chip:'投信買超',risk:'位階中性'},
    {d:'05/12',c:'2368',n:'金像電',p:298.5,q:3,s:84,reason:'多頭排列+籌碼集中',tech:'KD金叉',theme:'PCB延伸',chip:'外資買',risk:'追高留意'},
  ],
  aiSell:[
    {d:'05/15',c:'2454',n:'聯發科',p:1280,q:1,pnl:'+42,000',ret:'+3.4%',reason:'達停利目標',early:'否',late:'略晚',peak:'接近高'},
    {d:'05/11',c:'2618',n:'長榮航',p:38.5,q:10,pnl:'-6,500',ret:'-1.6%',reason:'觸發停損',early:'否',late:'合理',peak:'否'},
  ],
  aiReview:[
    {q:'是否買在合適位置',a:'是，於 20MA 附近進場，位階合理'},
    {q:'是否追高',a:'否，未在漲停 K 追入'},
    {q:'是否太早 / 太晚進場',a:'進場時點適中，量能確認後才買'},
    {q:'是否賣在相對高點',a:'聯發科賣點接近高，但略晚 1 日'},
    {q:'停損 / 停利是否合理',a:'停損 -8% 合理；停利可考慮分批'},
    {q:'選股 / 買賣點邏輯',a:'選股有效；建議賣點加入「爆量長上影」訊號'},
  ],
  aiVer:[
    {v:'v1.4',d:'2025/05/12',reason:'賣點過晚，加入長上影出場',old:'固定停利 +15%',new:'停利 +15% 或爆量長上影擇一',perf:'勝率 55%→58%'},
    {v:'v1.3',d:'2025/04/28',reason:'追高比例偏高',old:'題材分>80即買',new:'題材分>80 且未連3紅K',perf:'回撤 -12%→-9%'},
    {v:'v1.2',d:'2025/04/10',reason:'初版策略基準',old:'-',new:'建立題材動能基礎規則',perf:'基準'},
  ],

  dataStatus:[
    {k:'TWSE 每日收盤資料',ok:true,t:'16:05'},
    {k:'TWSE 法人買賣超',ok:true,t:'16:18'},
    {k:'TWSE 融資融券',ok:true,t:'16:22'},
    {k:'TPEX 每日收盤資料',ok:true,t:'16:30'},
    {k:'TPEX 法人買賣超',ok:true,t:'16:34'},
    {k:'MOPS 重大訊息',ok:true,t:'16:40'},
    {k:'MOPS 月營收',ok:false,t:'—',err:'當月營收尚未公布（每月10日前）'},
    {k:'Yahoo 新聞補充',ok:true,t:'16:42'},
    {k:'FinMind AI 詳細資料',ok:true,t:'依需求觸發'},
  ],

  adminStocks:[
    {c:'1815',n:'富喬',m:'上市',ind:'玻璃玻纖',th:'玻纖布',lead:true,obs:false},
    {c:'6274',n:'台燿',m:'上市',ind:'電子零組件',th:'CCL',lead:true,obs:false},
    {c:'2368',n:'金像電',m:'上市',ind:'電路板',th:'PCB',lead:false,obs:false},
    {c:'3231',n:'緯創',m:'上市',ind:'電腦週邊',th:'AI 伺服器',lead:false,obs:true},
  ],

  activation:[
    {id:'home',name:'今日市場總覽',enabled:true,days:30},
    {id:'map',name:'產業題材地圖',enabled:true,days:30},
    {id:'watch',name:'自選股',enabled:true,days:14},
    {id:'atr',name:'ATR 停利停損',enabled:true,days:14},
    {id:'screen',name:'每日篩選',enabled:true,days:14},
    {id:'stock',name:'個股分析',enabled:true,days:14},
    {id:'observe',name:'觀察報告',enabled:false,days:7},
    {id:'report',name:'每日報告',enabled:false,days:7},
    {id:'ai',name:'AI 模擬實驗室',enabled:false,days:7},
    {id:'status',name:'資料更新狀態',enabled:false,days:7},
  ],
};
const fmtPx=v=>{const n=Number(v);return isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';};
const sgn=v=>(v>0?'+':'')+v;
const fmtSigned=v=>{const n=Number(v);return isFinite(n)?`${n>0?'+':''}${Math.round(n).toLocaleString('en-US')}`:'—';};
const fmtInst=v=>{const n=Number(v);return isFinite(n)?fmtSigned(n/1000):'—';};
const fmtLot=v=>{const n=Number(v);return isFinite(n)?`${Math.round(n).toLocaleString('en-US')} 張`:'—';};
const dcls=v=>v>0?'up':(v<0?'down':'muted');

