/* AI 自動營運公司 - 核心流程預留
   第一版只在前端呈現營運狀態；後續可在這裡接 Supabase、排程與 AI API。 */
const AI_COMPANY_FORBIDDEN_ACTIONS=[
  'real_order',
  'delete_database',
  'modify_api_key',
  'auto_deploy_production',
  'publish_report_without_approval',
  'mass_push_notification'
];

function aiCompanyBuildRuntimeSnapshot(){
  const employees=typeof aiCoAgents==='function'?aiCoAgents():(window.AI_COMPANY_EMPLOYEES||[]);
  const logs=window.AI_COMPANY_LOGS||[];
  const approvals=window.AI_COMPANY_APPROVALS||[];
  return {
    status:'running',
    bossOnline:!!(typeof authUser==='function'&&authUser()),
    employees,
    logs,
    approvals,
    forbiddenActions:AI_COMPANY_FORBIDDEN_ACTIONS,
    updatedAt:new Date().toISOString()
  };
}
