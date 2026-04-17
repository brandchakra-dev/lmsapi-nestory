module.exports.ROLE_PERMISSIONS = {
  
  superadmin: [
    "MANAGE_USERS",
    "MANAGE_ROLES",
    "VIEW_LEADS",
    "CREATE_LEAD",
    "EDIT_LEAD",
    "DELETE_LEAD",
    "ASSIGN_MANAGER",
    "ASSIGN_EXECUTIVE",
    "UPDATE_LEAD_STATUS",
  ],

  admin: [
    "VIEW_LEADS",
    "CREATE_LEAD",
    "EDIT_LEAD",
    "DELETE_LEAD",
    "ASSIGN_MANAGER",
    "ASSIGN_EXECUTIVE",
    "UPDATE_LEAD_STATUS",
  ],

  manager: [
    "VIEW_LEADS",
    "CREATE_LEAD",
    "EDIT_LEAD",
    "ASSIGN_EXECUTIVE",
    "UPDATE_LEAD_STATUS",
  ],

  executive: [
    "VIEW_LEADS",
    "UPDATE_LEAD_STATUS", // follow-up, remarks, status
  ],
};
