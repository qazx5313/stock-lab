/* AI 自動營運公司 - 預設流程資料
   真實股票/市場數字會優先從既有 DATA 物件讀取；此檔只提供公司角色、任務流與空資料時的展示骨架。 */
const AI_COMPANY_EMPLOYEES=[
  {id:'supervisor',no:1,code:'AI',name:'AI 總主管',role:'Supervisor',dept:'總部指揮',status:'運作中',tasks:180,done:156,score:98.6,desc:'監控全體員工正常運作，分派任務並送審高風險事項。'},
  {id:'collector',no:2,code:'A',name:'A 資料蒐集員',role:'Data Collector',dept:'資料部',status:'運作中',tasks:86,done:84,score:96,desc:'蒐集 TWSE、TPEx、即時報價、新聞與盤後資料。'},
  {id:'analyst',no:3,code:'B',name:'B 資料分析員',role:'Data Analyst',dept:'分析部',status:'運作中',tasks:356,done:278,score:94,desc:'計算均線、MACD、KD、RSI、量價與資金強弱。'},
  {id:'screener',no:4,code:'C',name:'C 股票篩選員',role:'Stock Screener',dept:'選股部',status:'運作中',tasks:32,done:28,score:91,desc:'依技術、籌碼、題材與風險分數建立候選股。'},
  {id:'trader',no:5,code:'D',name:'D 模擬操盤員',role:'Trading Simulator',dept:'模擬交易',status:'運作中',tasks:12,done:9,score:88,desc:'只做模擬交易，產生買進、續抱、停利、停損理由。'},
  {id:'risk',no:6,code:'G',name:'G 風控員',role:'Risk Controller',dept:'風控部',status:'運作中',tasks:186,done:179,score:97,desc:'阻擋處置股、低量、過熱與需老闆批准的危險動作。'},
  {id:'review',no:7,code:'I',name:'I 檢討復盤員',role:'Review Officer',dept:'復盤部',status:'運作中',tasks:12,done:8,score:90,desc:'盤後檢討策略成效，建立明日改善任務。'},
  {id:'research',no:8,code:'E',name:'E 公司研究員',role:'Company Researcher',dept:'研究部',status:'待命',tasks:24,done:19,score:89,desc:'研究公司產品、供應鏈、營收、新聞與題材延續性。'},
  {id:'backtest',no:9,code:'F',name:'F 回測工程師',role:'Backtest Engineer',dept:'實驗室',status:'待命',tasks:18,done:15,score:92,desc:'驗證歷史相似條件、勝率、平均報酬與最大回撤。'},
  {id:'writer',no:10,code:'H',name:'H 報告產生員',role:'Report Writer',dept:'報告部',status:'待命',tasks:8,done:6,score:87,desc:'產生日報草稿，公開前必須送老闆審核。'}
];

const AI_COMPANY_LOGS=[
  {time:'15:15:20',agent:'AI 總主管',tone:'blue',text:'系統例行檢查完成，所有員工運作正常。',state:'ok'},
  {time:'15:14:52',agent:'A 資料蒐集員',tone:'blue',text:'已蒐集盤後新聞與即時報價資料。',state:'ok'},
  {time:'15:14:31',agent:'B 資料分析員',tone:'green',text:'今日市場強弱與量價結構分析完成。',state:'ok'},
  {time:'15:13:58',agent:'C 股票篩選員',tone:'purple',text:'新增候選標的並完成分數排序。',state:'ok'},
  {time:'15:13:25',agent:'D 模擬操盤員',tone:'orange',text:'模擬交易流程更新，等待風控確認。',state:'warn'},
  {time:'15:12:47',agent:'G 風控員',tone:'cyan',text:'偵測風險事件，已送老闆審核中心。',state:'warn'},
  {time:'15:11:36',agent:'I 檢討復盤員',tone:'red',text:'完成今日覆盤，提出策略優化建議。',state:'ok'}
];

const AI_COMPANY_APPROVALS=[
  {kind:'交易申請',title:'模擬買進候選股需確認風險',time:'15:10',level:'中'},
  {kind:'策略調整',title:'提高低量股票過濾門檻',time:'15:05',level:'高'},
  {kind:'公開報告',title:'每日報告草稿等待確認',time:'14:58',level:'低'}
];

const AI_COMPANY_MEETING=[
  '檢討今日勝率與虧損交易原因',
  '確認即時資料與盤後資料交接狀態',
  '優化停利停損與風控阻擋參數',
  '調整明日股票篩選條件',
  '回測新策略近期表現'
];
