const Earning = require('../models/Earning');

exports.getEarnings = async (req,res,next) => {
  try {
    const { role, _id } = req.user;
    let query = {};
    if(role === 'executive') query = { executive: _id };
    if(role === 'manager') {
      // manager sees earnings of their executives: implement as needed (placeholder)
      // For simplicity return all earnings for now
      query = {};
    }
    const earnings = await Earning.find(query).populate('lead executive').sort({ createdAt: -1 });
    res.json(earnings);
  } catch(e){ next(e); }
};

exports.approveEarning = async (req,res,next) => {
  try {
    const earning = await Earning.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
    res.json(earning);
  } catch(e){ next(e); }
};
