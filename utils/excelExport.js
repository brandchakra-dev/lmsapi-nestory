const XLSX = require("xlsx");

module.exports = (data)=>{
  const rows = data.map(a=>({
    Name: a.user.name,
    PunchIn: a.punchIn,
    PunchOut: a.punchOut,
    IP: a.ip
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");

  return XLSX.write(wb, { type:"buffer", bookType:"xlsx" });
};
