const express = require("express");
const router = express.Router();

router.use("/login", require("./login"));
router.use("/changePassword", require("./changePassword"));
router.use("/forgotPassword", require("./forgotPassword"));
router.use("/new", require("./new"));
router.use("/updateProjectStatus", require("./updateProjectStatus"));
router.use("/projectData", require("./projectData"));
router.use("/projectFamilies", require("./projectFamilies"));
router.use("/allProjects", require("./allProjects"));
router.use("/formValues", require("./formValues"));

router.use("/insertMember", require("./insertMember"));
router.use("/insertMemberFile", require("./insertMemberFile"));
router.use("/updateMember", require("./updateMember"));
router.use("/deleteMemberPhoto", require("./deleteMemberPhoto"));

router.use("/insertBasics", require("./insertBasics"));
router.use("/insertLocations", require("./insertLocations"));
router.use("/insertAdmins", require("./insertAdmins"));
router.use("/insertPeople", require("./insertPeople"));

router.use("/generics", require("./generics"));
router.use("/updateGenerics", require("./updateGenerics"));
router.use("/insertGenerics", require("./insertGenerics"));

router.use("/selectUsers", require("./selectUsers"));
router.use("/updateUsers", require("./updateUsers"));
router.use("/insertUser", require("./insertUser"));
router.use("/deleteUser", require("./deleteUser"));

router.use("/changeStage", require("./changeStage"));
router.use("/stageNotificationRoles", require("./stageNotificationRoles"));

router.use("/addBitacora", require("./addBitacora"));
router.use("/getBitacora", require("./getBitacora"));

router.use("/addProjectPhoto", require("./addProjectPhoto"));
router.use("/projectImages", require("./projectImages"));
router.use("/deleteProjectPhoto", require("./deleteProjectPhoto"));

router.use("/addLocationImage", require("./addLocationImage"));
router.use("/locationImages", require("./locationImages"));
router.use("/deleteLocationImage", require("./deleteLocationImage"));

router.use("/notifications", require("./notifications"));
router.use("/allNotifications", require("./allNotifications"));
router.use("/insertNotification", require("./insertNotification"));
router.use("/markNotificationRead", require("./markNotificationRead"));
router.use("/markAllNotificationsRead", require("./markAllNotificationsRead"));
router.use("/deleteNotification", require("./deleteNotification"));
router.use("/deleteAllNotifications", require("./deleteAllNotifications"));

module.exports = router;

