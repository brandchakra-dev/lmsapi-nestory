const Project = require("../models/Project");
const User = require("../models/User");

/* CREATE */
exports.createProject = async (req, res) => {
  const { name, address, lat, lng } = req.body;

  const project = await Project.create({
    name,
    address,
    location: { lat, lng },
    brochure: req.file ? `/uploads/brochures/${req.file.filename}` : null,
    createdBy: req.user._id
  });

  res.status(201).json(project);
};

/* UPDATE */
exports.updateProject = async (req, res) => {
  const update = req.body;

  if (req.file)
    update.brochure = `/uploads/brochures/${req.file.filename}`;

  const project = await Project.findByIdAndUpdate(req.params.id, update, {
    new: true
  });

  res.json(project);
};

/* DELETE */
exports.deleteProject = async (req, res) => {
  await Project.findByIdAndDelete(req.params.id);
  res.json({ message: "Project deleted" });
};

/* STATUS */
exports.toggleStatus = async (req, res) => {
  const project = await Project.findById(req.params.id);
  project.status = project.status === "active" ? "inactive" : "active";
  await project.save();
  res.json(project);
};

/* ASSIGN */
exports.assignProject = async (req, res) => {
  const { userIds } = req.body;

  const project = await Project.findById(req.params.id);

  // remove project from all users first
  await User.updateMany(
    { assignedProjects: project._id },
    { $pull: { assignedProjects: project._id } }
  );

  // add project to selected users
  await User.updateMany(
    { _id: { $in: userIds } },
    { $addToSet: { assignedProjects: project._id } }
  );

  project.assignedTo = userIds;
  await project.save();

  res.json({ message: "Assigned successfully" });
};


/* LIST ROLE BASED */
exports.getProjects = async (req, res) => {
  let filter = {};

  if (["manager", "executive"].includes(req.user.role)) {
    filter.assignedTo = req.user._id;
  }

  const projects = await Project.find(filter)
    .populate("assignedTo", "name role")
    .sort({ createdAt: -1 });

  res.json(projects);
};

/* GET SINGLE PROJECT */
exports.getProjectById = async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate("assignedTo", "name role email");

  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  // role restriction
  if (["manager", "executive"].includes(req.user.role)) {
    const assigned = project.assignedTo.some(
      u => u._id.toString() === req.user._id.toString()
    );
    if (!assigned) {
      return res.status(403).json({ message: "Not allowed" });
    }
  }

  res.json(project);
};
