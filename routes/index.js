const express = require("express");
const router = express.Router();

router.use("/login", require("./login"));
router.use("/new", require("./new"));
router.use("/test", require("./test"));
router.use("/projectData", require("./projectData"));
router.use("/allProjects", require("./allProjects"));
router.use("/formValues", require("./formValues"));

router.use("/insertMember", require("./insertMember"));
router.use("/insertMemberFile", require("./insertMemberFile"));

router.use("/insertBasics", require("./insertBasics"));
router.use("/insertLocations", require("./insertLocations"));
router.use("/insertAdmins", require("./insertAdmins"));
router.use("/insertPeople", require("./insertPeople"));

router.use("/generics", require("./generics"));
router.use("/updateGenerics", require("./updateGenerics"));

router.use("/selectUsers", require("./selectUsers"));
router.use("/updateUsers", require("./updateUsers"));

router.use("/changeStage", require("./changeStage"));

router.use("/addBitacora", require("./addBitacora"));
router.use("/getBitacora", require("./getBitacora"));

router.use("/addProjectPhoto", require("./addProjectPhoto"));
router.use("/projectImages", require("./projectImages"));
module.exports = router;

