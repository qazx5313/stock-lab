/* AI 自動營運公司 - 資料型別預留
   未來若改成 TypeScript，可直接把這些 JSDoc typedef 搬成 .ts interface。 */

/**
 * @typedef {Object} AIEmployee
 * @property {string} id
 * @property {string} name
 * @property {string} role
 * @property {string} department
 * @property {string} status
 * @property {string} currentTask
 * @property {number} todayTaskCount
 * @property {number} completedTaskCount
 * @property {number} failedTaskCount
 * @property {number} performanceScore
 * @property {string[]} permissions
 * @property {string[]} forbiddenActions
 * @property {string} lastReport
 * @property {string} lastUpdatedAt
 */

/**
 * @typedef {Object} AITask
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} assignedBy
 * @property {string} assignedTo
 * @property {'low'|'medium'|'high'|'critical'} priority
 * @property {'queued'|'running'|'done'|'failed'|'waiting_approval'} status
 * @property {number} progress
 * @property {Object} inputData
 * @property {Object} outputData
 * @property {string} startedAt
 * @property {string} deadline
 * @property {string} completedAt
 * @property {number} retryCount
 * @property {string} errorMessage
 * @property {boolean} needHumanApproval
 */

/**
 * @typedef {Object} TradingSimulation
 * @property {string} id
 * @property {string} stockSymbol
 * @property {string} stockName
 * @property {string} strategyType
 * @property {string} buyReason
 * @property {number} entryPrice
 * @property {number} stopLossPrice
 * @property {number} targetPrice1
 * @property {number} targetPrice2
 * @property {number} holdingDays
 * @property {string} currentStatus
 * @property {string} latestNewsImpact
 * @property {string} exitReason
 * @property {number} exitPrice
 * @property {number} pnlPercent
 * @property {string} createdBy
 * @property {string} reviewedBy
 * @property {string} createdAt
 * @property {string} updatedAt
 */

const AI_COMPANY_SCHEMA=[
  'BossApproval','AIEmployee','AISupervisor','AITask','AITaskAssignment','AIWorkLog',
  'AIMeeting','AIMeetingNote','MarketDataRaw','MarketDataClean','AnalysisResult',
  'StockCandidate','StockScore','CompanyResearch','TradingSimulation','BacktestResult',
  'RiskEvent','ImprovementSuggestion','DailyReport'
];
