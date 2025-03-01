import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
    const token = req.headers.token;
    if (!token) {
      return res.status(401).json({ message:'Unauthorized Access',login:false})
      
    }
    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, user) => {
      if (err) return  res.status(403).json({message:'Forbidden'});
      req.user = user;
      next();
    });
  };