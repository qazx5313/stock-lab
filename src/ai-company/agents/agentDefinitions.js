/* AI 自動營運公司 - 員工定義
   這裡保留未來替換成真實 Agent Runtime 的界面。 */
const AI_COMPANY_AGENT_DEFINITIONS=[
  {id:'supervisor',module:'supervisorAgent',canAssign:true,canTrade:false},
  {id:'collector',module:'dataCollectorAgent',canFetchData:true,canTrade:false},
  {id:'analyst',module:'dataAnalystAgent',canAnalyze:true,canTrade:false},
  {id:'screener',module:'stockScreenerAgent',canScreen:true,canTrade:false},
  {id:'trader',module:'tradingSimulatorAgent',canSimulate:true,canTrade:false},
  {id:'research',module:'companyResearchAgent',canResearch:true,canTrade:false},
  {id:'backtest',module:'backtestEngineerAgent',canBacktest:true,canTrade:false},
  {id:'risk',module:'riskControllerAgent',canBlockRisk:true,canTrade:false},
  {id:'writer',module:'reportWriterAgent',canDraftReport:true,canTrade:false},
  {id:'review',module:'reviewOfficerAgent',canReview:true,canTrade:false}
];
