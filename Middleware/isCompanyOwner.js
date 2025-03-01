import User from "../Model/userModel.js";

export const isCompanyOwner = async (req, res, next) => {
    const userid = req.user.id;
    const userDetail = await User.findById(userid);
    const role = userDetail.role;
    
    if(role == "Owner"){
        next();
    }else{
        res.status(403).json({message:'Unauthorized', isCompanyOwner:false})
    }
}