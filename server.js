require('dotenv').config();
const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const multer = require('multer');
const path = require('path');  // Require the path module
const bodyParser = require("body-parser");
const jwt = require('jsonwebtoken'); // Include jsonwebtoken
const nodemailer = require("nodemailer");



const app = express();
const PORT = 15080;


// Middleware
app.use(cors());
app.use(bodyParser.json());


// MySQL Connection
const db = mysql.createConnection({
    host: process.env.sql108.infinityfree.com,
    user: process.env.if0_38940004 , // Change if needed
    password: process.env.nati1627, // Change if needed
    database: process.env.if0_38940004_senbet, // Replace with your database name
});

db.connect((err) => {
    if (err) {
        console.error("Database connection failed: ", err);
        process.exit(1); // Exit if there's a connection error
    } else {
        console.log("Connected to MySQL Database");
    }
});





// Middleware to check authentication
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.sendStatus(403);

    jwt.verify(token, 'your_jwt_secret', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}



// Set up multer for file storage
// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Directory to save the uploaded files
    },
    filename: (req, file, cb) => {
        cb(null,file.fieldname + '-' + Date.now() + path.extname(file.originalname)); // Append timestamp to the file name
    }
});

const upload = multer({ storage: storage });





// Login route
app.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ status: "error", message: "Username and password are required." });
    }

    db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ status: "error", message: "Internal server error." });
        }
        if (results.length === 0) {
            return res.status(401).json({ status: "error", message: "User not found or incorrect password." });
        }
        const user = results[0];
        const token = jwt.sign({ username: user.username, role: user.role }, 'your_jwt_secret');
        res.json({ status: "success", token, role: user.role });
    });
});


// Endpoint to get user role
app.get('/user/role', authenticateToken, (req, res) => {
    res.json({ role: req.user.role });
});



// Endpoint to get user photo using username
app.get('/user/photo', authenticateToken, (req, res) => {
    const username = req.user.username; // Assuming username is stored in the token

    db.query('SELECT photo FROM users WHERE username = ?', [username], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }

        if (results.length > 0) {
            const userPhoto = results[0].photo; // Get the photo URL
            return res.json({
                status: 'success',
                photo: userPhoto // Return the photo URL
            });
        } else {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }
    });
});



// Member page route
app.get('/member', async (req, res) => {
    try {
        const menuOptions = await getMenuOptions(req); // Correctly passing req
        res.json({ menuOptions });
    } catch (error) {
        console.error('Error fetching member options:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



// Generate and store verification code
let verificationCodes = {};

app.post("/forgot-password", (req, res) => {
    const { username } = req.body;
    db.query("SELECT mobile FROM users WHERE username = ?", [username], (err, result) => {
        if (err || result.length === 0) {
            return res.json({ success: false, message: "ያስገቡት ስም አልተገኘም!" });
        }

        const phone = result[0].mobile;
        const code = Math.floor(100000 + Math.random() * 900000);
        verificationCodes[username] = code;

        console.log(`የማረጋገጫ ቁጥር ለ ${username}: ${code}`);

        res.json({ success: true, message: "የማረጋገጫ ቁጥር ወደ ስልክ ቁጥሮት ተልኳል!" });
    });
});

app.post("/verify-code", (req, res) => {
    const { username, code } = req.body;
    if (verificationCodes[username] == code) {
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "የተሳሳተ ኮድ!" });
    }
});

app.post("/reset-password", (req, res) => {
    const { username, newPassword } = req.body;
    db.query("UPDATE users SET password = ? WHERE username = ?", [newPassword, username], (err) => {
        if (err) return res.json({ success: false, message: "የሚስጥር ቁጥሮትን መቀየር አልተቻለም!" });

        delete verificationCodes[username];
        res.json({ success: true, message: "የሚስጥር ቁጥሮት በተሳካ ሁኔታ ተቀይሯል!" });
    });
});




// Example function to get user role, adjust as necessary
async function getUserRole(req) {
    // Get user role from a token or session
    const token = req.headers['authorization'];

    if (!token) return 'normal_user'; // Default if no token

    try {
        const response = await fetch("http://localhost:15080/user/role", {
            method: "GET",
            headers: { "Authorization": token }
        });

        if (response.ok) {
            const data = await response.json();
            return data.role || 'normal_user';
        } else {
            return 'normal_user';
        }
    } catch (error) {
        console.error("Error fetching user role:", error);
        return 'normal_user';
    }
}

// Function to get menu options based on user role
async function getMenuOptions(req) {
    const userRole = await getUserRole(req); // Ensure this returns a valid role
    const allowedRoles = ['admin', 'super_admin', 'sub_admin'];

    const allOptions = [
        { 
            id: 1, 
            name: 'ጽሕፈት ቤት', 
            role: ['admin','sub_admin'], 
            subOptions: [
                { 
                    id: '1-1', 
                    name: 'የአባላት ዝርዝር', 
                    subSubOptions: [
                        { name: 'አጠቃላይ አባላት', page: 'fetch_in.html' },
                        { name: 'የጽሕፈት ቤት አባላት', page: 'fetch_main.html' }
                    ]
                },
                { 
                    id: '1-2', 
                    name: 'የተማሪዎች ዝርዝር',
                    subSubOptions: [
                        { name: 'የህጻናት ክፍል', page: 'fetchKidCourse.html' },
                        { name: 'የትምህርት ክፍል', page: 'fetchEducationCourse.html' },
                        { name: 'የመዝሙር ክፍል', page: 'fetchMusicCourse.html' }
                    ]
                },
                { 
                    id: '1-3', 
                    name: 'እቅድ ማስገቢያ', 
                    subSubOptions: [
                        { name: 'የጽሕፈት ቤት አመታዊ እቅድ', page: 'directorPlan.html' },
                        { name: 'የሰ/ት/ቤቱ ክፍሎች አመታዊ እቅድ', page: 'fetchPlan.html' }
                      ]
                },
                { 
                    id: '1-4', 
                    name: 'ሪፖርት ማስገቢያ', 
                    subSubOptions: [
                        { name: 'የጽሕፈት ቤት ሪፖርት', page: 'reportMain.html' },
                        { name: 'የሰ/ት/ቤቱ ክፍሎች ሪፖርት', page: 'fetchReport.html' }
                    ]
                },
                { 
                    id: '1-5', 
                    name: 'የስራ ተዋረድና እድሳት', 
                    subSubOptions: [
                        { name: 'የአባላት የስራ ተዋረድ', page: 'role.html' },
                        { name: 'እድሳት', page: 'editForm.html' }
                    ]
                },
                // Add more sub-options here if needed
            ]
        },

        { 
            id: 2, 
            name: 'ትምህርት ክፍል', 
            role: ['adminEducation', 'sub_adminEducation', 'member_Education'],
            subOptions: [
                { 
                    id: '2-1', 
                    name: 'መመዝገቢያ', 
                    subSubOptions: [
                        { name: 'ቅዳማይ', page: 'kedamaycourse.html' },
                        { name: 'ካልአይ', page: 'kalaycourse.html' },
                        { name: 'ሳልሳይ', page: 'salsaycourse.html' },
                        { name: 'ራብአይ', page: 'rabaycourse.html' },
                        { name: 'ሃምሳይ', page: 'hamsaycourse.html' },
                        { name: 'ሳድሳይ', page: 'sadsaycourse.html' }
                    ]
                },
                { 
                    id: '2-2', 
                    name: 'ንኡስ ክፍል', 
                    subSubOptions: [
                        { name: '#', page: '#' },
                        { name: '#', page: '#' },
                        { name: '#', page: '#' }
                    ]
                },
                { 
                    id: '2-3', 
                    name: 'የክፍል አባላት', 
                    subSubOptions: [
                        { name: 'አባላት', page: 'fetch_edu.html' }
                      ]
                },
                { 
                    id: '2-4', 
                    name: 'እቅድ ማስገቢያ', 
                    subSubOptions: [
                        { name: 'አመታዊ እቅድ', page: 'educationPlan.html' }
                      ]
                },
                { 
                    id: '2-5', 
                    name: 'ሪፖርት ማስገቢያ',
                    subSubOptions: [
                        { name: 'የክፍል ሪፖርት', page: 'reportEducation.html' }
                    ]
                },
                // Add more sub-options here if needed
            ]
        },
        { 
            id: 3, 
            name: 'መዝሙር ክፍል', 
            role: ['adminMusic', 'sub_adminMusic', 'member_Music'], 
            subOptions: [
                { 
                    id: '3-1', 
                    name: 'መመዝገቢያ', 
                    subSubOptions: [
                        { name: 'ካልአይ', page: 'kalayMusicCourse.html' },
                        { name: 'ሳልሳይ', page: 'salsayMusicCourse.html' },
                        { name: 'ማእከላውያን', page: 'maekelawyanMusicCourse.html' },
                        { name: 'ቋሚ መዘምራን', page: 'kuamiMusicCourse.html' },
                    ]
                },
                { 
                    id: '3-2', 
                    name: 'ንኡስ ክፍል', 
                    subSubOptions: [
                        { name: 'ቅዳማይ', page: 'option-5-1-1' },
                        { name: 'ካልአይ', page: 'option-5-1-2' },
                        { name: 'ሳልሳይ', page: 'option-5-1-3' }
                    ]
                },
                { 
                    id: '3-3', 
                    name: 'የክፍል አባላት',
                    subSubOptions: [
                        { name: 'አባላት', page: 'fetch_music.html' }
                    ]
                },
                { 
                    id: '3-4', 
                    name: 'እቅድ ማስገቢያ',
                    subSubOptions: [
                        { name: 'አመታዊ እቅድ', page: 'musicPlan.html' }
                      ]
                },
                { 
                    id: '3-5', 
                    name: 'ሪፖርት ማስገቢያ', 
                    subSubOptions: [
                        { name: 'የክፍል ሪፖርት', page: 'reportMusic.html' }
                    ]
                },
                // Add more sub-options here if needed
            ]
        },
        { 
            id: 4, 
            name: 'ኪነ ጥበብ ክፍል', 
            role: ['adminArt', 'sub_adminArt', 'member_Art'],
            subOptions: [
                { 
                    id: '4-1', 
                    name: 'ንኡስ ክፍል', 
                    subSubOptions: [
                        { name: 'ቅዳማይ', page: 'option-4-1-1' },
                        { name: 'ካልአይ', page: 'option-4-1-2' },
                        { name: 'ሳልሳይ', page: 'option-4-1-3' }
                    ]
                },
                { 
                    id: '4-2', 
                    name: 'የክፍል አባላት', 
                    subSubOptions: [
                        { name: 'አባላት', page: 'fetch_art.html' }
                    ]
                },
                { 
                    id: '4-3', 
                    name: 'እቅድ ማስገቢያ', 
                    subSubOptions: [
                        { name: 'አመታዊ እቅድ', page: 'artPlan.html' }
                      ]
                },
                { 
                    id: '4-4', 
                    name: 'ሪፖርት ማስገቢያ',
                    subSubOptions: [
                        { name: 'የክፍል ሪፖርት', page: 'reportArt.html' }
                    ]
                },
                // Add more sub-options here if needed
            ]
        },
        { 
            id: 5, 
            name: 'ልማት ክፍል', 
            role: ['adminDevelopment', 'sub_adminDevelopment', 'member_Development'],
            subOptions: [
                { 
                    id: '5-1', 
                    name: 'ንኡስ ክፍል', 
                    subSubOptions: [
                        { name: 'ቅዳማይ', page: 'option-4-1-1' },
                        { name: 'ካልአይ', page: 'option-4-1-2' },
                        { name: 'ሳልሳይ', page: 'option-4-1-3' }
                    ]
                },
                { 
                    id: '5-2', 
                    name: 'የክፍል አባላት', 
                    subSubOptions: [
                        { name: 'አባላት', page: 'fetch_dev.html' }
                    ]
                },
                { 
                    id: '5-3', 
                    name: 'እቅድ ማስገቢያ',
                    subSubOptions: [
                        { name: 'አመታዊ እቅድ', page: 'developmentPlan.html' }
                      ]
                },
                { 
                    id: '5-4', 
                    name: 'ሪፖርት ማስገቢያ', 
                    subSubOptions: [
                        { name: 'የክፍል ሪፖርት', page: 'reportDevelopment.html' }
                    ]
                },
                // Add more sub-options here if needed
            ]
        },
        { 
            id: 6, 
            name: 'የውስጥ ግንኙነት ክፍል', 
            role: ['adminCommunication', 'sub_adminCommunication', 'member_Communication'],
            subOptions: [
                { 
                    id: '6-1', 
                    name: 'መመዝገቢያ እና እድሳት',
                    subSubOptions: [
                        { name: 'አዲስ ምዝገባ',  page: 'formkalay.html' },
                        { name: 'እድሳት',  page: 'option-5-1-4' },
                    ]
                },
                { 
                    id: '6-2', 
                    name: 'ንኡስ ክፍል', 
                    subSubOptions: [
                        { name: 'ቅዳማይ', page: 'option-5-1-1' },
                        { name: 'ካልአይ', page: 'option-5-1-2' },
                        { name: 'ሳልሳይ', page: 'option-5-1-3' }
                    ]
                },
                { 
                    id: '6-3', 
                    name: 'የክፍል አባላት', 
                    subSubOptions: [
                        { name: 'አጠቃላይ አባላት', page: 'fetch_in.html' },
                        { name: 'የክፍሉ አባላት', page: 'fetch_my.html' }
                    ]
                },
                { 
                    id: '6-4', 
                    name: 'እቅድ ማስገቢያ', 
                    subSubOptions: [
                        { name: 'አመታዊ እቅድ', page: 'communicationPlan.html' }
                      ]
                },
                { 
                    id: '6-5', 
                    name: 'ሪፖርት ማስገቢያ',
                    subSubOptions: [
                        { name: 'የክፍል ሪፖርት', page: 'reportCommunication.html' }
                    ]
                },
                // Add more sub-options here if needed
            ]
        },
        { 
            id: 7, 
            name: 'በጎ አድራጎት ክፍል', 
            role: ['adminAid', 'sub_adminAid', 'member_Aid'],
            subOptions: [
                { 
                    id: '7-1', 
                    name: 'ንኡስ ክፍል', 
                    subSubOptions: [
                        { name: 'ቅዳማይ', page: 'option-4-1-1' },
                        { name: 'ካልአይ', page: 'option-4-1-2' },
                        { name: 'ሳልሳይ', page: 'option-4-1-3' }
                    ]
                },
                { 
                    id: '7-2', 
                    name: 'የክፍል አባላት',
                    subSubOptions: [
                        { name: 'አባላት', page: 'fetch_aid.html' }
                    ]
                },
                { 
                    id: '7-3', 
                    name: 'እቅድ ማስገቢያ', 
                    subSubOptions: [
                        { name: 'አመታዊ እቅድ', page: 'aidPlan.html' }
                      ]
                },
                { 
                    id: '7-4', 
                    name: 'ሪፖርት ማስገቢያ', 
                    subSubOptions: [
                        { name: 'የክፍል ሪፖርት', page: 'reportAid.html' }
                    ]
                },
                // Add more sub-options here if needed
            ]
        },
        { 
            id: 8, 
            name: 'ዶክመንቴሽን ክፍል', 
            role: ['adminDocumentation', 'sub_adminDocumentation', 'member_Documentation'],
            subOptions: [
                { 
                    id: '8-1', 
                    name: 'ንኡስ ክፍል',
                    subSubOptions: [
                        { name: 'ቅዳማይ', page: 'option-4-1-1' },
                        { name: 'ካልአይ', page: 'option-4-1-2' },
                        { name: 'ሳልሳይ', page: 'option-4-1-3' }
                    ]
                },
                { 
                    id: '8-2', 
                    name: 'የክፍል አባላት',
                    subSubOptions: [
                        { name: 'አባላት', page: 'fetch_doc.html' }
                    ]
                },
                { 
                    id: '8-3', 
                    name: 'እቅድ ማስገቢያ', 
                    subSubOptions: [
                        { name: 'አመታዊ እቅድ', page: 'documentationPlan.html' }
                      ]
                },
                { 
                    id: '8-4', 
                    name: 'ሪፖርት ማስገቢያ',
                    subSubOptions: [
                        { name: 'የክፍል ሪፖርት', page: 'reportDocumentation.html' }
                    ]
                },
                // Add more sub-options here if needed
            ]
        },
        { 
            id: 9, 
            name: 'ህጻናት ክፍል', 
            role: ['adminKid', 'sub_adminKid', 'member_Kid'],
            subOptions: [
                { 
                    id: '9-1', 
                    name: 'መመዝገቢያ',
                    subSubOptions: [
                        { name: 'ቅዳማይ', page: 'kidOne.html' },
                        { name: 'ካልአይ', page: 'kidTwo.html' },
                        { name: 'ሳልሳይ', page: 'kidThree.html' },
                        { name: 'ራብአይ', page: 'kidFour.html' },
                        { name: 'ሃምሳይ', page: 'kidFive.html' }
                    ]
                },
                { 
                    id: '9-2', 
                    name: 'ንኡስ ክፍል',
                    subSubOptions: [
                        { name: '#', page: '#' },
                        { name: '#', page: '#' },
                        { name: '#', page: '#' }
                    ]
                },
                { 
                    id: '9-3', 
                    name: 'የክፍል አባላት',
                    subSubOptions: [
                        { name: 'አባላት', page: 'fetch_kid.html' }
                      ]
                },
                { 
                    id: '9-4', 
                    name: 'እቅድ ማስገቢያ', 
                    subSubOptions: [
                        { name: 'አመታዊ እቅድ', page: 'kidPlan.html' }
                      ]
                },
                { 
                    id: '9-5', 
                    name: 'ሪፖርት ማስገቢያ',
                    subSubOptions: [
                        { name: 'የክፍል ሪፖርት', page: 'reportKid.html' }
                    ]
                },
                // Add more sub-options here if needed
            ]
        },
        { 
            id: 10, 
            name: 'ምክረ አበው ክፍል', 
            role: ['adminOld', 'sub_adminOld', 'member_Old'],
            subOptions: [
                { 
                    id: '10-1', 
                    name: 'ንኡስ ክፍል',
                    subSubOptions: [
                        { name: 'ቅዳማይ', page: 'option-4-1-1' },
                        { name: 'ካልአይ', page: 'option-4-1-2' },
                        { name: 'ሳልሳይ', page: 'option-4-1-3' }
                    ]
                },
                { 
                    id: '10-2', 
                    name: 'የክፍል አባላት',
                    subSubOptions: [
                        { name: 'አባላት', page: 'fetch_old.html' }
                    ]
                },
                { 
                    id: '10-3', 
                    name: 'እቅድ ማስገቢያ', 
                    subSubOptions: [
                        { name: 'አመታዊ እቅድ', page: 'oldPlan.html' }
                      ]
                },
                { 
                    id: '10-4', 
                    name: 'ሪፖርት ማስገቢያ',
                    subSubOptions: [
                        { name: 'የክፍል ሪፖርት', page: 'reportOld.html' }
                    ]
                },
                // Add more sub-options here if needed
            ]
        },
        { 
            id: 11, 
            name: 'ስልጠናና መርሀ ግብር ክፍል', 
            role: ['adminTrain', 'sub_adminTrain', 'member_Train'],
            subOptions: [
                { 
                    id: '11-1', 
                    name: 'ንኡስ ክፍል',
                    subSubOptions: [
                        { name: 'ቅዳማይ', page: 'option-4-1-1' },
                        { name: 'ካልአይ', page: 'option-4-1-2' },
                        { name: 'ሳልሳይ', page: 'option-4-1-3' }
                    ]
                },
                { 
                    id: '11-2', 
                    name: 'የክፍል አባላት', 
                    subSubOptions: [
                        { name: 'አባላት', page: 'fetch_train.html' }
                    ]
                },
                { 
                    id: '11-3', 
                    name: 'እቅድ ማስገቢያ', 
                    subSubOptions: [
                        { name: 'አመታዊ እቅድ', page: 'trainPlan.html' }
                      ]
                },
                { 
                    id: '11-4', 
                    name: 'ሪፖርት ማስገቢያ', 
                    subSubOptions: [
                        { name: 'የክፍል ሪፖርት', page: 'reportTrain.html' }
                    ]
                },
                // Add more sub-options here if needed
            ]
        },
        { 
            id: 12, 
            name: 'ጥናትና ምርምር ክፍል', 
            role: ['adminResearch', 'sub_adminResearch', 'member_Research'],  
            subOptions: [
                { 
                    id: '12-1', 
                    name: 'ንኡስ ክፍል',
                    subSubOptions: [
                        { name: 'ቅዳማይ', page: 'option-4-1-1' },
                        { name: 'ካልአይ', page: 'option-4-1-2' },
                        { name: 'ሳልሳይ', page: 'option-4-1-3' }
                    ]
                },
                { 
                    id: '12-2', 
                    name: 'የክፍል አባላት',
                    subSubOptions: [
                        { name: 'አባላት', page: 'fetch_research.html' }
                    ]
                },
                { 
                    id: '12-3', 
                    name: 'እቅድ ማስገቢያ',
                    subSubOptions: [
                        { name: 'አመታዊ እቅድ', page: 'researchPlan.html' }
                      ]
                },
                { 
                    id: '12-4', 
                    name: 'ሪፖርት ማስገቢያ', 
                    subSubOptions: [
                        { name: 'የክፍል ሪፖርት', page: 'reportResearch.html' }
                    ]
                },
                // Add more sub-options here if needed
            ]
        },
        { 
            id: 13, 
            name: 'ውጪ ግንኙነት ክፍል', 
            role: ['adminOut', 'sub_adminOut', 'member_Out'],
            subOptions: [
                { 
                    id: '13-1', 
                    name: 'ንኡስ ክፍል',
                    subSubOptions: [
                        { name: 'ቅዳማይ', page: 'option-4-1-1' },
                        { name: 'ካልአይ', page: 'option-4-1-2' },
                        { name: 'ሳልሳይ', page: 'option-4-1-3' }
                    ]
                },
                { 
                    id: '13-2', 
                    name: 'የክፍል አባላት',
                    subSubOptions: [
                        { name: 'አባላት', page: 'fetch_out.html' }
                    ]
                },
                { 
                    id: '13-3', 
                    name: 'እቅድ ማስገቢያ',
                    subSubOptions: [
                        { name: 'አመታዊ እቅድ', page: 'outPlan.html' }
                      ]
                },
                { 
                    id: '13-4', 
                    name: 'ሪፖርት ማስገቢያ', 
                    subSubOptions: [
                        { name: 'የክፍል ሪፖርት', page: 'reportOut.html' }
                    ]
                },
                // Add more sub-options here if needed
            ]
        },

        // Add more options as needed
    ];


    // Filter logic
    const filteredOptions = allOptions.filter(option => 
        option.role.includes(userRole) || 
        allowedRoles.includes(userRole)
    );

    return filteredOptions;
}


function hasPermission(userRole, action) {
    const permissions = {
        save: ['admin', 'super_admin', 'sub_admin'],
        submit: ['admin', 'super_admin', 'sub_admin'],
        assign: ['admin', 'super_admin'],
        delete: ['admin', 'super_admin']
    };

    return permissions[action] && permissions[action].includes(userRole);
}



app.post("/submit-form", upload.single('fileInput'), async (req, res) => {

    // Example function to get user role, adjust as necessary
async function getUserRole(req) {
    // Get user role from a token or session
    const token = req.headers['authorization'];
    console.log("Received Token:", token); // Log the received token
    if (!token) return 'normal_user'; // Default if no token

    try {
        const response = await fetch("http://localhost:15080/user/role", {
            method: "GET",
            headers: { "Authorization": token }
        });

        if (response.ok) {
            const data = await response.json();
            return data.role || 'normal_user';
        } else {
            return 'normal_user';
        }
    } catch (error) {
        console.error("Error fetching user role:", error);
        return 'normal_user';
    }
}
    const userRole = await getUserRole(req);
    console.log("User Role in Server:", userRole); // Log the user role

    const action = 'submit'; // Define the action we are checking for
    console.log("Checking Permission for Action:", action); // Log the action being checked

    if (!hasPermission(userRole, action)) {
        console.log("Permission Denied: User does not have permission to submit."); // Log permission failure
        return res.status(403).json({ error: 'Forbidden: You do not have permission to submit.' });
    }

    

    const {
        name,
        father_name,
        grandfather_name,
        birth_year,
        birth_month,
        birth_day,
        address_city,
        district,
        house_number,
        mobile,
        alternate_phone,
        email,
        baptism_name,
        father_christian_name,
        father_service_location,
        education_1_8,
        education_9_10,
        education_11_12,
        college_name1,
        college_start1,
        college_end1,
        college_name2,
        college_start2,
        college_end2,
        college_name3,
        college_start3,
        college_end3,
        occupation1,
        occupation2,
        occupation3,
        current_study_field,
        current_study_institution,
        work_status,
        employer_name,
        marriage_status,
        living_with,
        spiritual_service_before,
        spiritual_service_place_name,
        service_option_part1,
        service_option_part2,
        service_option_part3,
        full_name,
        relatives_name1,
        relatives_name2,
        relatives_name3,
        relatives_phone1,
        relatives_phone2,
        relatives_phone3,
        registration_year
    } = req.body;

    console.log("Uploaded file:", req.file); // Log the received file
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const photo = req.file.path; // Get the file path
  

    const query = `
        INSERT INTO mh.form_data (
            photo, name, father_name, grandfather_name, birth_year, birth_month, birth_day,
            address_city, district, house_number, mobile, alternate_phone, email,
            baptism_name, father_christian_name, father_service_location,
            education_1_8, education_9_10, education_11_12,
            college_name1, college_start1, college_end1,
            college_name2, college_start2, college_end2,
            college_name3, college_start3, college_end3,
            occupation1, occupation2, occupation3,
            current_study_field, current_study_institution, work_status,
            employer_name, marriage_status, living_with,
            spiritual_service_before, spiritual_service_place_name,
            service_option_part1, service_option_part2, service_option_part3,
            full_name,
            relatives_name1, relatives_name2, relatives_name3,
            relatives_phone1, relatives_phone2, relatives_phone3, registration_year
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
        photo, // Include the photo path
        req.body.name || null, req.body.father_name || null, req.body.grandfather_name || null, 
        req.body.birth_year || null, req.body.birth_month || null, req.body.birth_day || null, 
        req.body.address_city || null, req.body.district || null, req.body.house_number || null, 
        req.body.mobile || null, req.body.alternate_phone || null, req.body.email || null,
        req.body.baptism_name || null, req.body.father_christian_name || null, req.body.father_service_location || null,
        req.body.education_1_8 || null, req.body.education_9_10 || null, req.body.education_11_12 || null,
        req.body.college_name1 || null, req.body.college_start1 || null, req.body.college_end1 || null,
        req.body.college_name2 || null, req.body.college_start2 || null, req.body.college_end2 || null,
        req.body.college_name3 || null, req.body.college_start3 || null, req.body.college_end3 || null,
        req.body.occupation1 || null, req.body.occupation2 || null, req.body.occupation3 || null,
        req.body.current_study_field || null, req.body.current_study_institution || null, req.body.work_status || null,
        req.body.employer_name || null, req.body.marriage_status || null, req.body.living_with || null,
        req.body.spiritual_service_before || null, req.body.spiritual_service_place_name || null,
        req.body.service_option_part1 || null, req.body.service_option_part2 || null, req.body.service_option_part3 || null,
        req.body.full_name || null,
        req.body.relatives_name1 || null, req.body.relatives_name2 || null, req.body.relatives_name3 || null,
        req.body.relatives_phone1 || null, req.body.relatives_phone2 || null, req.body.relatives_phone3 || null, req.body.registration_year || null
    ];

    db.query(query, values, (err, results) => {
        if (err) {
            console.error("Database error: ", err.sqlMessage);
            return res.status(500).json({ status: "error", message: "Database error: " + err.sqlMessage });
        }
        res.json({ status: "success", message: "Form submitted successfully!" });
    });
});

function hasPermission(userRole, action) {
    const permissions = {
        submit: ['admin', 'super_admin']
    };
    return permissions[action] && permissions[action].includes(userRole);
}



       // Route to fetch data
app.get('/fetch-data', (req, res) => {
    const year = req.query.year; // Get the year from query parameters
    const name = req.query.name; // Get the name from query parameters
    let query = "SELECT * FROM mh.form_data"; // Base query
    const params = [];

    if (year || name) {
        query += " WHERE";
        if (year) {
            query += " registration_year = ?";
            params.push(year);
        }
        if (name) {
            if (year) query += " AND"; // Add AND if there's already a condition
            query += " name LIKE ?";
            params.push(`%${name}%`); // Use LIKE for partial matches
        }
    }

    db.query(query, params, (err, results) => {
        if (err) {
            console.error("Database query error:", err);
            return res.status(500).json({
                status: "error",
                message: "Database query error: " + err.message
            });
        }
        res.json(results); // Send results as JSON
    });
});



//delete user by name and father name
app.delete('/delete-user', (req, res) => {
    const { name, fatherName } = req.body; // Get name and father's name from the request body

    const query = "DELETE FROM mh.form_data WHERE name = ? AND father_name = ?"; // Adjust if necessary

    db.query(query, [name, fatherName], (err, results) => {
        if (err) {
            console.error("Database delete error:", err);
            return res.status(500).json({
                status: "error",
                message: "Database delete error: " + err.message
            });
        }
        res.json({ status: "success", message: "User deleted successfully." });
    });
});


//assign to database
app.post('/assign-to-class', (req, res) => {
    const { name, fatherName, mobile, className } = req.body;

    // Check if the user is already assigned to a class
    const checkQuery = "SELECT * FROM ?? WHERE name = ? AND father_name = ?";
    db.query(checkQuery, [className, name, fatherName], (err, results) => {
        if (err) {
            console.error("Database check error:", err);
            return res.status(500).json({
                status: "error",
                message: "Database check error: " + err.message
            });
        }

        if (results.length > 0) {
            return res.status(400).json({ status: "error", message: "User already assigned to this class." });
        }

        // Insert the user into the selected class table
        const insertQuery = "INSERT INTO ?? (name, father_name, mobile) VALUES (?, ?, ?)";
        db.query(insertQuery, [className, name, fatherName, mobile], (err, results) => {
            if (err) {
                console.error("Database insert error:", err);
                return res.status(500).json({
                    status: "error",
                    message: "Database insert error: " + err.message
                });
            }
            res.json({ status: "success", message: "User assigned successfully." });
        });
    });
});




// Route to handle form submission
// Fetch Data
app.get('/api/form_data', (req, res) => {
    db.query('SELECT * FROM form_data', (error, results) => {
        if (error) return res.status(500).send(error);
        res.json(results);
    });
});

// Update Data
app.put('/api/form_data/:id', upload.single('photo'), (req, res) => {
    console.log("Request Body: ", req.body); // Log the request body
    const id = req.params.id;
    const updatedData = {};

    // If a photo was uploaded
    if (req.file) {
        updatedData.photo = `uploads/${req.file.filename}`; // Store with folder name
    }

    // Check for other fields in req.body
    // Add fields dynamically based on what is sent
    Object.keys(req.body).forEach(key => {
        if (req.body[key]) {
            updatedData[key] = req.body[key]; // Capture all fields that are present
        }
    });

    console.log("Updated Data: ", updatedData); // Log the updated data to check

    // Ensure there's at least one field to update
    if (Object.keys(updatedData).length === 0) {
        return res.status(400).send('የመረጃ ማስተካከያ አልትደረገም።');
    }

    // Execute the update query
    db.query('UPDATE form_data SET ? WHERE id = ?', [updatedData, id], (error) => {
        if (error) {
            console.error('Database Error: ', error);
            return res.status(500).send(error);
        }
        res.send('መረጃው በተሳካ ሁኔታ ተቀይሯል!');
    });
});



// Endpoint to fetch users
app.get('/users', (req, res) => {
    db.query('SELECT username, password, name, father_name, role FROM users', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        res.json(results);
    });
});


// Endpoint to update user role
app.post('/users/update-role', (req, res) => {
    const { username, role } = req.body;

    if (!username || !role) {
        return res.status(400).json({ status: 'error', message: 'Username and role are required' });
    }

    db.query('UPDATE users SET role = ? WHERE username = ?', [role, username], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }

        if (results.affectedRows > 0) {
            return res.json({ status: 'success', message: 'Role updated successfully' });
        } else {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }
    });
});



//fetch_classes
app.get('/fetch-main', (req, res) => {
        const query = "SELECT * FROM mh.ጽሕፈት_ቤት"; // Adjust table name as necessary
        db.query(query, (err, results) => {
            if (err) {
                console.error("Database query error:", err);
                return res.status(500).json({
                    status: "error",
                    message: "Database query error: " + err.message
                });
            }
            res.json(results); // Send results as JSON
        });
    });



//fetch_education
app.get('/fetch-education', (req, res) => {
        const query = "SELECT * FROM mh.ትምህርት_ክፍል"; // Adjust table name as necessary
        db.query(query, (err, results) => {
            if (err) {
                console.error("Database query error:", err);
                return res.status(500).json({
                    status: "error",
                    message: "Database query error: " + err.message
                });
            }
            res.json(results); // Send results as JSON
        });
    });


//fetch_music
app.get('/fetch-music', (req, res) => {
        const query = "SELECT * FROM mh.መዝሙር_ክፍል"; // Adjust table name as necessary
        db.query(query, (err, results) => {
            if (err) {
                console.error("Database query error:", err);
                return res.status(500).json({
                    status: "error",
                    message: "Database query error: " + err.message
                });
            }
            res.json(results); // Send results as JSON
        });
    });


    //fetch_art
app.get('/fetch-art', (req, res) => {
        const query = "SELECT * FROM mh.ኪነ_ጥበብ_ክፍል"; // Adjust table name as necessary
        db.query(query, (err, results) => {
            if (err) {
                console.error("Database query error:", err);
                return res.status(500).json({
                    status: "error",
                    message: "Database query error: " + err.message
                });
            }
            res.json(results); // Send results as JSON
        });
    });



    //fetch_development
    app.get('/fetch-development', (req, res) => {
            const query = "SELECT * FROM mh.ልማት_ክፍል"; // Adjust table name as necessary
            db.query(query, (err, results) => {
                if (err) {
                    console.error("Database query error:", err);
                    return res.status(500).json({
                        status: "error",
                        message: "Database query error: " + err.message
                    });
                }
                res.json(results); // Send results as JSON
            });
        });



 //fetch_inside
 app.get('/fetch-inside', (req, res) => {
        const query = "SELECT * FROM mh.የውስጥ_ግንኙነት_ክፍል"; // Adjust table name as necessary
        db.query(query, (err, results) => {
            if (err) {
                console.error("Database query error:", err);
                return res.status(500).json({
                    status: "error",
                    message: "Database query error: " + err.message
                });
            }
            res.json(results); // Send results as JSON
        });
    });


//fetch_aid
app.get('/fetch-aid', (req, res) => {
        const query = "SELECT * FROM mh.በጎ_አድራጎት_ክፍል"; // Adjust table name as necessary
        db.query(query, (err, results) => {
            if (err) {
                console.error("Database query error:", err);
                return res.status(500).json({
                    status: "error",
                    message: "Database query error: " + err.message
                });
            }
            res.json(results); // Send results as JSON
        });
    });



//fetch_documentation
app.get('/fetch-document', (req, res) => {
        const query = "SELECT * FROM mh.ዶክመንቴሽን_ክፍል"; // Adjust table name as necessary
        db.query(query, (err, results) => {
            if (err) {
                console.error("Database query error:", err);
                return res.status(500).json({
                    status: "error",
                    message: "Database query error: " + err.message
                });
            }
            res.json(results); // Send results as JSON
        });
    });




//fetch_kid
app.get('/fetch-kid', (req, res) => {
        const query = "SELECT * FROM mh.ህጻናት_ክፍል"; // Adjust table name as necessary
        db.query(query, (err, results) => {
            if (err) {
                console.error("Database query error:", err);
                return res.status(500).json({
                    status: "error",
                    message: "Database query error: " + err.message
                });
            }
            res.json(results); // Send results as JSON
        });
    });



//fetch_old
app.get('/fetch-old', (req, res) => {
        const query = "SELECT * FROM mh.ምክረ_አበው_ክፍል"; // Adjust table name as necessary
        db.query(query, (err, results) => {
            if (err) {
                console.error("Database query error:", err);
                return res.status(500).json({
                    status: "error",
                    message: "Database query error: " + err.message
                });
            }
            res.json(results); // Send results as JSON
        });
    });



//fetch_training
app.get('/fetch-training', (req, res) => {
        const query = "SELECT * FROM mh.ስልጠናና_መርሐ_ግብር_ክፍል"; // Adjust table name as necessary
        db.query(query, (err, results) => {
            if (err) {
                console.error("Database query error:", err);
                return res.status(500).json({
                    status: "error",
                    message: "Database query error: " + err.message
                });
            }
            res.json(results); // Send results as JSON
        });
    });



//fetch_research
app.get('/fetch-research', (req, res) => {
        const query = "SELECT * FROM mh.ጥናትና_ምርምር_ክፍል"; // Adjust table name as necessary
        db.query(query, (err, results) => {
            if (err) {
                console.error("Database query error:", err);
                return res.status(500).json({
                    status: "error",
                    message: "Database query error: " + err.message
                });
            }
            res.json(results); // Send results as JSON
        });
    });



//fetch_out
app.get('/fetch-out', (req, res) => {
        const query = "SELECT * FROM mh.ውጪ_ግንኙነት_ክፍል"; // Adjust table name as necessary
        db.query(query, (err, results) => {
            if (err) {
                console.error("Database query error:", err);
                return res.status(500).json({
                    status: "error",
                    message: "Database query error: " + err.message
                });
            }
            res.json(results); // Send results as JSON
        });
    });



// Save Director_Plans
app.post("/main_plan_save", (req, res) => {

    const plans = req.body;
    const queries = plans.map(plan => {
        const { type, quantity, checkboxes } = plan;

        return new Promise((resolve, reject) => {
            // Step 1: Check if the row already exists
            const checkQuery = `
                SELECT COUNT(*) AS count FROM plan_director 
                WHERE \`type\` = ? AND quantity = ? AND meskerem = ? AND tikimt = ? AND hidar = ? 
                AND tahsas = ? AND tir = ? AND yekatit = ? AND megabit = ? AND miyazya = ? 
                AND ginbot = ? AND sene = ? AND hamle = ? AND nehase = ?;
            `;

            db.query(checkQuery, [type, quantity, ...checkboxes], (checkError, results) => {
                if (checkError) {
                    reject(checkError);
                    return;
                }

                if (results[0].count > 0) {
                    // Duplicate row found, skip insertion
                    resolve();
                } else {
                    // Step 2: Insert if not duplicate
                    const insertQuery =` 
                        INSERT INTO plan_director (\`type\`, quantity, meskerem, tikimt, hidar, tahsas, tir, yekatit, megabit, miyazya, ginbot, sene, hamle, nehase)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(insertQuery, [type, quantity, ...checkboxes], (insertError) => {
                        if (insertError) reject(insertError);
                        else resolve();
                    });
                }
            });
        });
    });

    // Step 3: Handle Promise resolution
    Promise.all(queries)
        .then(() => res.status(201).send({ message: "እቅዱ ወደ መረጃ ቋት ገብቷል፣ ተመሳሳይነት ያላችው የሉም።" }))
        .catch(error => {
            console.error("እቅዱን ለማስገባት አለተቻለም።", error);
            res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
        });
});
    
    // Fetch Plans
    app.get("/main_plans", (req, res) => {
        db.query('SELECT * FROM plan_Director', (error, results) => {
            if (error) {
                console.error("የመረጃ ቋት ችግር:", error);
                return res.status(500).json({ message: "እቅዱን ማግኘት አልተቻለም።" });
            }
    
            if (!results || results.length === 0) {
                console.warn("ምንም የእቅድ ዝርዝር የለም።");
                return res.json([]);
            }
    
            console.log("የተዘረዘሩ እቅዶች:", results); // Debugging log
    
            const plans = results.map(plan => ({
                id: plan.id,
                type: plan.type,
                quantity: plan.quantity,
                checkboxes: [
                    plan.meskerem, plan.tikimt, plan.hidar, plan.tahsas,
                    plan.tir, plan.yekatit, plan.megabit, plan.miyazya,
                    plan.ginbot, plan.sene, plan.hamle, plan.nehase
                ]
            }));
    
            res.json(plans);
        });
    });
    
    // Delete Plan
    app.delete("/main_plans/:id", (req, res) => {

        db.query("DELETE FROM plan_Director WHERE id = ?", [req.params.id], (error) => {
            if (error) {
                return res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
            }
            res.status(200).send({ message: "እቅዱ ተስርዟል!" });
        });
    });





    // Save Education_Plans
app.post("/education_plan_save", (req, res) => {

    const plans = req.body;
    const queries = plans.map(plan => {
        const { type, quantity, checkboxes } = plan;

        return new Promise((resolve, reject) => {
            // Step 1: Check if the row already exists
            const checkQuery = `
                SELECT COUNT(*) AS count FROM plan_education 
                WHERE \`type\` = ? AND quantity = ? AND meskerem = ? AND tikimt = ? AND hidar = ? 
                AND tahsas = ? AND tir = ? AND yekatit = ? AND megabit = ? AND miyazya = ? 
                AND ginbot = ? AND sene = ? AND hamle = ? AND nehase = ?;
            `;

            db.query(checkQuery, [type, quantity, ...checkboxes], (checkError, results) => {
                if (checkError) {
                    reject(checkError);
                    return;
                }

                if (results[0].count > 0) {
                    // Duplicate row found, skip insertion
                    resolve();
                } else {
                    // Step 2: Insert if not duplicate
                    const insertQuery =` 
                        INSERT INTO plan_education (\`type\`, quantity, meskerem, tikimt, hidar, tahsas, tir, yekatit, megabit, miyazya, ginbot, sene, hamle, nehase)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(insertQuery, [type, quantity, ...checkboxes], (insertError) => {
                        if (insertError) reject(insertError);
                        else resolve();
                    });
                }
            });
        });
    });

    // Step 3: Handle Promise resolution
    Promise.all(queries)
        .then(() => res.status(201).send({ message: "እቅዱ ወደ መረጃ ቋት ገብቷል፣ ተመሳሳይነት ያላችው የሉም።" }))
        .catch(error => {
            console.error("እቅዱን ለማስገባት አለተቻለም።", error);
            res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
        });
});
    
    // Fetch Plans
    app.get("/education_plans", (req, res) => {
        db.query('SELECT * FROM plan_education', (error, results) => {
            if (error) {
                console.error("የመረጃ ቋት ችግር:", error);
                return res.status(500).json({ message: "እቅዱን ማግኘት አልተቻለም።" });
            }
    
            if (!results || results.length === 0) {
                console.warn("ምንም የእቅድ ዝርዝር የለም።");
                return res.json([]);
            }
    
            console.log("የተዘረዘሩ እቅዶች:", results); // Debugging log
    
            const plans = results.map(plan => ({
                id: plan.id,
                type: plan.type,
                quantity: plan.quantity,
                checkboxes: [
                    plan.meskerem, plan.tikimt, plan.hidar, plan.tahsas,
                    plan.tir, plan.yekatit, plan.megabit, plan.miyazya,
                    plan.ginbot, plan.sene, plan.hamle, plan.nehase
                ]
            }));
    
            res.json(plans);
        });
    });
    
    // Delete Plan
    app.delete("/education_plans/:id", (req, res) => {

        db.query("DELETE FROM plan_education WHERE id = ?", [req.params.id], (error) => {
            if (error) {
                return res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
            }
            res.status(200).send({ message: "እቅዱ ተስርዟል!" });
        });
    });

    


// Save Music_Plans
app.post("/music_plan_save", (req, res) => {

    const plans = req.body;
    const queries = plans.map(plan => {
        const { type, quantity, checkboxes } = plan;

        return new Promise((resolve, reject) => {
            // Step 1: Check if the row already exists
            const checkQuery = `
                SELECT COUNT(*) AS count FROM plan_music 
                WHERE \`type\` = ? AND quantity = ? AND meskerem = ? AND tikimt = ? AND hidar = ? 
                AND tahsas = ? AND tir = ? AND yekatit = ? AND megabit = ? AND miyazya = ? 
                AND ginbot = ? AND sene = ? AND hamle = ? AND nehase = ?;
            `;

            db.query(checkQuery, [type, quantity, ...checkboxes], (checkError, results) => {
                if (checkError) {
                    reject(checkError);
                    return;
                }

                if (results[0].count > 0) {
                    // Duplicate row found, skip insertion
                    resolve();
                } else {
                    // Step 2: Insert if not duplicate
                    const insertQuery =` 
                        INSERT INTO plan_music (\`type\`, quantity, meskerem, tikimt, hidar, tahsas, tir, yekatit, megabit, miyazya, ginbot, sene, hamle, nehase)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(insertQuery, [type, quantity, ...checkboxes], (insertError) => {
                        if (insertError) reject(insertError);
                        else resolve();
                    });
                }
            });
        });
    });

    // Step 3: Handle Promise resolution
    Promise.all(queries)
        .then(() => res.status(201).send({ message: "እቅዱ ወደ መረጃ ቋት ገብቷል፣ ተመሳሳይነት ያላችው የሉም።" }))
        .catch(error => {
            console.error("እቅዱን ለማስገባት አለተቻለም።", error);
            res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
        });
});
    
    // Fetch Plans
    app.get("/music_plans", (req, res) => {
        db.query('SELECT * FROM plan_music', (error, results) => {
            if (error) {
                console.error("የመረጃ ቋት ችግር:", error);
                return res.status(500).json({ message: "እቅዱን ማግኘት አልተቻለም።" });
            }
    
            if (!results || results.length === 0) {
                console.warn("ምንም የእቅድ ዝርዝር የለም።");
                return res.json([]);
            }
    
            console.log("የተዘረዘሩ እቅዶች:", results); // Debugging log
    
            const plans = results.map(plan => ({
                id: plan.id,
                type: plan.type,
                quantity: plan.quantity,
                checkboxes: [
                    plan.meskerem, plan.tikimt, plan.hidar, plan.tahsas,
                    plan.tir, plan.yekatit, plan.megabit, plan.miyazya,
                    plan.ginbot, plan.sene, plan.hamle, plan.nehase
                ]
            }));
    
            res.json(plans);
        });
    });
    
    // Delete Plan
    app.delete("/music_plans/:id", (req, res) => {

        db.query("DELETE FROM plan_music WHERE id = ?", [req.params.id], (error) => {
            if (error) {
                return res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
            }
            res.status(200).send({ message: "እቅዱ ተስርዟል!" });
        });
    });




    // Save Art_Plans
app.post("/art_plan_save", (req, res) => {

    const plans = req.body;
    const queries = plans.map(plan => {
        const { type, quantity, checkboxes } = plan;

        return new Promise((resolve, reject) => {
            // Step 1: Check if the row already exists
            const checkQuery = `
                SELECT COUNT(*) AS count FROM plan_art 
                WHERE \`type\` = ? AND quantity = ? AND meskerem = ? AND tikimt = ? AND hidar = ? 
                AND tahsas = ? AND tir = ? AND yekatit = ? AND megabit = ? AND miyazya = ? 
                AND ginbot = ? AND sene = ? AND hamle = ? AND nehase = ?;
            `;

            db.query(checkQuery, [type, quantity, ...checkboxes], (checkError, results) => {
                if (checkError) {
                    reject(checkError);
                    return;
                }

                if (results[0].count > 0) {
                    // Duplicate row found, skip insertion
                    resolve();
                } else {
                    // Step 2: Insert if not duplicate
                    const insertQuery =` 
                        INSERT INTO plan_art (\`type\`, quantity, meskerem, tikimt, hidar, tahsas, tir, yekatit, megabit, miyazya, ginbot, sene, hamle, nehase)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(insertQuery, [type, quantity, ...checkboxes], (insertError) => {
                        if (insertError) reject(insertError);
                        else resolve();
                    });
                }
            });
        });
    });

    // Step 3: Handle Promise resolution
    Promise.all(queries)
        .then(() => res.status(201).send({ message: "እቅዱ ወደ መረጃ ቋት ገብቷል፣ ተመሳሳይነት ያላችው የሉም።" }))
        .catch(error => {
            console.error("እቅዱን ለማስገባት አለተቻለም።", error);
            res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
        });
});
    
    // Fetch Plans
    app.get("/art_plans", (req, res) => {
        db.query('SELECT * FROM plan_art', (error, results) => {
            if (error) {
                console.error("የመረጃ ቋት ችግር:", error);
                return res.status(500).json({ message: "እቅዱን ማግኘት አልተቻለም።" });
            }
    
            if (!results || results.length === 0) {
                console.warn("ምንም የእቅድ ዝርዝር የለም።");
                return res.json([]);
            }
    
            console.log("የተዘረዘሩ እቅዶች:", results); // Debugging log
    
            const plans = results.map(plan => ({
                id: plan.id,
                type: plan.type,
                quantity: plan.quantity,
                checkboxes: [
                    plan.meskerem, plan.tikimt, plan.hidar, plan.tahsas,
                    plan.tir, plan.yekatit, plan.megabit, plan.miyazya,
                    plan.ginbot, plan.sene, plan.hamle, plan.nehase
                ]
            }));
    
            res.json(plans);
        });
    });
    
    // Delete Plan
    app.delete("/art_plans/:id",(req, res) => {

        db.query("DELETE FROM plan_art WHERE id = ?", [req.params.id], (error) => {
            if (error) {
                return res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
            }
            res.status(200).send({ message: "እቅዱ ተስርዟል!" });
        });
    });



// Save Development_Plans
app.post("/development_plan_save", (req, res) => {

    const plans = req.body;
    const queries = plans.map(plan => {
        const { type, quantity, checkboxes } = plan;

        return new Promise((resolve, reject) => {
            // Step 1: Check if the row already exists
            const checkQuery = `
                SELECT COUNT(*) AS count FROM plan_development 
                WHERE \`type\` = ? AND quantity = ? AND meskerem = ? AND tikimt = ? AND hidar = ? 
                AND tahsas = ? AND tir = ? AND yekatit = ? AND megabit = ? AND miyazya = ? 
                AND ginbot = ? AND sene = ? AND hamle = ? AND nehase = ?;
            `;

            db.query(checkQuery, [type, quantity, ...checkboxes], (checkError, results) => {
                if (checkError) {
                    reject(checkError);
                    return;
                }

                if (results[0].count > 0) {
                    // Duplicate row found, skip insertion
                    resolve();
                } else {
                    // Step 2: Insert if not duplicate
                    const insertQuery =` 
                        INSERT INTO plan_development (\`type\`, quantity, meskerem, tikimt, hidar, tahsas, tir, yekatit, megabit, miyazya, ginbot, sene, hamle, nehase)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(insertQuery, [type, quantity, ...checkboxes], (insertError) => {
                        if (insertError) reject(insertError);
    
                        else resolve();
                    });
                }
            });
        });
    });

    // Step 3: Handle Promise resolution
    Promise.all(queries)
        .then(() => res.status(201).send({ message: "እቅዱ ወደ መረጃ ቋት ገብቷል፣ ተመሳሳይነት ያላችው የሉም።" }))
        .catch(error => {
            console.error("እቅዱን ለማስገባት አለተቻለም።", error);
            res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
        });
});
    
    // Fetch Plans
    app.get("/development_plans", (req, res) => {
        db.query('SELECT * FROM plan_development', (error, results) => {
            if (error) {
                console.error("የመረጃ ቋት ችግር:", error);
                return res.status(500).json({ message: "እቅዱን ማግኘት አልተቻለም።" });
            }
    
            if (!results || results.length === 0) {
                console.warn("ምንም የእቅድ ዝርዝር የለም።");
                return res.json([]);
            }
    
            console.log("የተዘረዘሩ እቅዶች:", results); // Debugging log
    
            const plans = results.map(plan => ({
                id: plan.id,
                type: plan.type,
                quantity: plan.quantity,
                checkboxes: [
                    plan.meskerem, plan.tikimt, plan.hidar, plan.tahsas,
                    plan.tir, plan.yekatit, plan.megabit, plan.miyazya,
                    plan.ginbot, plan.sene, plan.hamle, plan.nehase
                ]
            }));
    
            res.json(plans);
        });
    });
    
    // Delete Plan
    app.delete("/development_plans/:id", (req, res) => {

        db.query("DELETE FROM plan_development WHERE id = ?", [req.params.id], (error) => {
            if (error) {
                return res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
            }
            res.status(200).send({ message: "እቅዱ ተስርዟል!" });
        });
    });



    // Save Communication_Plans
app.post("/communication_plan_save",(req, res) => {

    const plans = req.body;
    const queries = plans.map(plan => {
        const { type, quantity, checkboxes } = plan;

        return new Promise((resolve, reject) => {
            // Step 1: Check if the row already exists
            const checkQuery = `
                SELECT COUNT(*) AS count FROM plan_communication 
                WHERE \`type\` = ? AND quantity = ? AND meskerem = ? AND tikimt = ? AND hidar = ? 
                AND tahsas = ? AND tir = ? AND yekatit = ? AND megabit = ? AND miyazya = ? 
                AND ginbot = ? AND sene = ? AND hamle = ? AND nehase = ?;
            `;

            db.query(checkQuery, [type, quantity, ...checkboxes], (checkError, results) => {
                if (checkError) {
                    reject(checkError);
                    return;
                }

                if (results[0].count > 0) {
                    // Duplicate row found, skip insertion
                    resolve();
                } else {
                    // Step 2: Insert if not duplicate
                    const insertQuery =` 
                        INSERT INTO plan_communication (\`type\`, quantity, meskerem, tikimt, hidar, tahsas, tir, yekatit, megabit, miyazya, ginbot, sene, hamle, nehase)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(insertQuery, [type, quantity, ...checkboxes], (insertError) => {
                        if (insertError) reject(insertError);
                        else resolve();
                    });
                }
            });
        });
    });

    // Step 3: Handle Promise resolution
    Promise.all(queries)
        .then(() => res.status(201).send({ message: "እቅዱ ወደ መረጃ ቋት ገብቷል፣ ተመሳሳይነት ያላችው የሉም።" }))
        .catch(error => {
            console.error("እቅዱን ለማስገባት አለተቻለም።", error);
            res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
        });
});
    
    // Fetch Plans
    app.get("/communication_plans", (req, res) => {
        db.query('SELECT * FROM plan_communication', (error, results) => {
            if (error) {
                console.error("የመረጃ ቋት ችግር:", error);
                return res.status(500).json({ message: "እቅዱን ማግኘት አልተቻለም።" });
            }
    
            if (!results || results.length === 0) {
                console.warn("ምንም የእቅድ ዝርዝር የለም።");
                return res.json([]);
            }
    
            console.log("የተዘረዘሩ እቅዶች:", results); // Debugging log
    
            const plans = results.map(plan => ({
                id: plan.id,
                type: plan.type,
                quantity: plan.quantity,
                checkboxes: [
                    plan.meskerem, plan.tikimt, plan.hidar, plan.tahsas,
                    plan.tir, plan.yekatit, plan.megabit, plan.miyazya,
                    plan.ginbot, plan.sene, plan.hamle, plan.nehase
                ]
            }));
    
            res.json(plans);
        });
    });
    
    // Delete Plan
    app.delete("/communication_plans/:id", (req, res) => {

        db.query("DELETE FROM plan_communication WHERE id = ?", [req.params.id], (error) => {
            if (error) {
                return res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
            }
            res.status(200).send({ message: "እቅዱ ተስርዟል!" });
        });
    });




// Save Aid_Plans
app.post("/aid_plan_save", (req, res) => {

    const plans = req.body;
    const queries = plans.map(plan => {
        const { type, quantity, checkboxes } = plan;

        return new Promise((resolve, reject) => {
            // Step 1: Check if the row already exists
            const checkQuery = `
                SELECT COUNT(*) AS count FROM plan_aid 
                WHERE \`type\` = ? AND quantity = ? AND meskerem = ? AND tikimt = ? AND hidar = ? 
                AND tahsas = ? AND tir = ? AND yekatit = ? AND megabit = ? AND miyazya = ? 
                AND ginbot = ? AND sene = ? AND hamle = ? AND nehase = ?;
            `;

            db.query(checkQuery, [type, quantity, ...checkboxes], (checkError, results) => {
                if (checkError) {
                    reject(checkError);
                    return;
                }

                if (results[0].count > 0) {
                    // Duplicate row found, skip insertion
                    resolve();
                } else {
                    // Step 2: Insert if not duplicate
                    const insertQuery =` 
                        INSERT INTO plan_aid (\`type\`, quantity, meskerem, tikimt, hidar, tahsas, tir, yekatit, megabit, miyazya, ginbot, sene, hamle, nehase)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(insertQuery, [type, quantity, ...checkboxes], (insertError) => {
                        if (insertError) reject(insertError);
                        else resolve();
                    });
                }
            });
        });
    });

    // Step 3: Handle Promise resolution
    Promise.all(queries)
        .then(() => res.status(201).send({ message: "እቅዱ ወደ መረጃ ቋት ገብቷል፣ ተመሳሳይነት ያላችው የሉም።" }))
        .catch(error => {
            console.error("እቅዱን ለማስገባት አለተቻለም።", error);
            res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
        });
});
    
    // Fetch Plans
    app.get("/aid_plans", (req, res) => {
        db.query('SELECT * FROM plan_aid', (error, results) => {
            if (error) {
                console.error("የመረጃ ቋት ችግር:", error);
                return res.status(500).json({ message: "እቅዱን ማግኘት አልተቻለም።" });
            }
    
            if (!results || results.length === 0) {
                console.warn("ምንም የእቅድ ዝርዝር የለም።");
                return res.json([]);
            }
    
            console.log("የተዘረዘሩ እቅዶች:", results); // Debugging log
    
            const plans = results.map(plan => ({
                id: plan.id,
                type: plan.type,
                quantity: plan.quantity,
                checkboxes: [
                    plan.meskerem, plan.tikimt, plan.hidar, plan.tahsas,
                    plan.tir, plan.yekatit, plan.megabit, plan.miyazya,
                    plan.ginbot, plan.sene, plan.hamle, plan.nehase
                ]
            }));
    
            res.json(plans);
        });
    });
    
    // Delete Plan
    app.delete("/aid_plans/:id", (req, res) => {

        db.query("DELETE FROM plan_aid WHERE id = ?", [req.params.id], (error) => {
            if (error) {
                return res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
            }
            res.status(200).send({ message: "እቅዱ ተስርዟል!" });
        });
    });



// Save Documentation_Plans
app.post("/documentation_plan_save", (req, res) => {

    const plans = req.body;
    const queries = plans.map(plan => {
        const { type, quantity, checkboxes } = plan;

        return new Promise((resolve, reject) => {
            // Step 1: Check if the row already exists
            const checkQuery = `
                SELECT COUNT(*) AS count FROM plan_documentation 
                WHERE \`type\` = ? AND quantity = ? AND meskerem = ? AND tikimt = ? AND hidar = ? 
                AND tahsas = ? AND tir = ? AND yekatit = ? AND megabit = ? AND miyazya = ? 
                AND ginbot = ? AND sene = ? AND hamle = ? AND nehase = ?;
            `;

            db.query(checkQuery, [type, quantity, ...checkboxes], (checkError, results) => {
                if (checkError) {
                    reject(checkError);
                    return;
                }

                if (results[0].count > 0) {
                    // Duplicate row found, skip insertion
                    resolve();
                } else {
                    // Step 2: Insert if not duplicate
                    const insertQuery =` 
                        INSERT INTO plan_documentation (\`type\`, quantity, meskerem, tikimt, hidar, tahsas, tir, yekatit, megabit, miyazya, ginbot, sene, hamle, nehase)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(insertQuery, [type, quantity, ...checkboxes], (insertError) => {
                        if (insertError) reject(insertError);
                        else resolve();
                    });
                }
            });
        });
    });

    // Step 3: Handle Promise resolution
    Promise.all(queries)
        .then(() => res.status(201).send({ message: "እቅዱ ወደ መረጃ ቋት ገብቷል፣ ተመሳሳይነት ያላችው የሉም።" }))
        .catch(error => {
            console.error("እቅዱን ለማስገባት አለተቻለም።", error);
            res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
        });
});
    
    // Fetch Plans
    app.get("/documentation_plans", (req, res) => {
        db.query('SELECT * FROM plan_documentation', (error, results) => {
            if (error) {
                console.error("የመረጃ ቋት ችግር:", error);
                return res.status(500).json({ message: "እቅዱን ማግኘት አልተቻለም።" });
            }
    
            if (!results || results.length === 0) {
                console.warn("ምንም የእቅድ ዝርዝር የለም።");
                return res.json([]);
            }
    
            console.log("የተዘረዘሩ እቅዶች:", results); // Debugging log
    
            const plans = results.map(plan => ({
                id: plan.id,
                type: plan.type,
                quantity: plan.quantity,
                checkboxes: [
                    plan.meskerem, plan.tikimt, plan.hidar, plan.tahsas,
                    plan.tir, plan.yekatit, plan.megabit, plan.miyazya,
                    plan.ginbot, plan.sene, plan.hamle, plan.nehase
                ]
            }));
    
            res.json(plans);
        });
    });
    
    // Delete Plan
    app.delete("/documentation_plans/:id", (req, res) => {


        db.query("DELETE FROM plan_documentation WHERE id = ?", [req.params.id], (error) => {
            if (error) {
                return res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
            }
            res.status(200).send({ message: "እቅዱ ተስርዟል!" });
        });
    });



    // Save Kid_Plans
app.post("/kid_plan_save", (req, res) => {

    const plans = req.body;
    const queries = plans.map(plan => {
        const { type, quantity, checkboxes } = plan;

        return new Promise((resolve, reject) => {
            // Step 1: Check if the row already exists
            const checkQuery = `
                SELECT COUNT(*) AS count FROM plan_kid 
                WHERE \`type\` = ? AND quantity = ? AND meskerem = ? AND tikimt = ? AND hidar = ? 
                AND tahsas = ? AND tir = ? AND yekatit = ? AND megabit = ? AND miyazya = ? 
                AND ginbot = ? AND sene = ? AND hamle = ? AND nehase = ?;
            `;

            db.query(checkQuery, [type, quantity, ...checkboxes], (checkError, results) => {
                if (checkError) {
                    reject(checkError);
                    return;
                }

                if (results[0].count > 0) {
                    // Duplicate row found, skip insertion
                    resolve();
                } else {
                    // Step 2: Insert if not duplicate
                    const insertQuery =` 
                        INSERT INTO plan_kid (\`type\`, quantity, meskerem, tikimt, hidar, tahsas, tir, yekatit, megabit, miyazya, ginbot, sene, hamle, nehase)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(insertQuery, [type, quantity, ...checkboxes], (insertError) => {
                        if (insertError) reject(insertError);
                        else resolve();
                    });
                }
            });
        });
    });

    // Step 3: Handle Promise resolution
    Promise.all(queries)
        .then(() => res.status(201).send({ message: "እቅዱ ወደ መረጃ ቋት ገብቷል፣ ተመሳሳይነት ያላችው የሉም።" }))
        .catch(error => {
            console.error("እቅዱን ለማስገባት አለተቻለም።", error);
            res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
        });
});
    
    // Fetch Plans
    app.get("/kid_plans", (req, res) => {
        db.query('SELECT * FROM plan_kid', (error, results) => {
            if (error) {
                console.error("የመረጃ ቋት ችግር:", error);
                return res.status(500).json({ message: "እቅዱን ማግኘት አልተቻለም።" });
            }
    
            if (!results || results.length === 0) {
                console.warn("ምንም የእቅድ ዝርዝር የለም።");
                return res.json([]);
            }
    
            console.log("የተዘረዘሩ እቅዶች:", results); // Debugging log
    
            const plans = results.map(plan => ({
                id: plan.id,
                type: plan.type,
                quantity: plan.quantity,
                checkboxes: [
                    plan.meskerem, plan.tikimt, plan.hidar, plan.tahsas,
                    plan.tir, plan.yekatit, plan.megabit, plan.miyazya,
                    plan.ginbot, plan.sene, plan.hamle, plan.nehase
                ]
            }));
    
            res.json(plans);
        });
    });
    
    // Delete Plan
    app.delete("/kid_plans/:id", (req, res) => {

        db.query("DELETE FROM plan_kid WHERE id = ?", [req.params.id], (error) => {
            if (error) {
                return res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
            }
            res.status(200).send({ message: "እቅዱ ተስርዟል!" });
        });
    });



// Save Old_Plans
app.post("/old_plan_save", (req, res) => {

    const plans = req.body;
    const queries = plans.map(plan => {
        const { type, quantity, checkboxes } = plan;

        return new Promise((resolve, reject) => {
            // Step 1: Check if the row already exists
            const checkQuery = `
                SELECT COUNT(*) AS count FROM plan_old
                WHERE \`type\` = ? AND quantity = ? AND meskerem = ? AND tikimt = ? AND hidar = ? 
                AND tahsas = ? AND tir = ? AND yekatit = ? AND megabit = ? AND miyazya = ? 
                AND ginbot = ? AND sene = ? AND hamle = ? AND nehase = ?;
            `;

            db.query(checkQuery, [type, quantity, ...checkboxes], (checkError, results) => {
                if (checkError) {
                    reject(checkError);
                    return;
                }

                if (results[0].count > 0) {
                    // Duplicate row found, skip insertion
                    resolve();
                } else {
                    // Step 2: Insert if not duplicate
                    const insertQuery =` 
                        INSERT INTO plan_old (\`type\`, quantity, meskerem, tikimt, hidar, tahsas, tir, yekatit, megabit, miyazya, ginbot, sene, hamle, nehase)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(insertQuery, [type, quantity, ...checkboxes], (insertError) => {
                        if (insertError) reject(insertError);
                        else resolve();
                    });
                }
            });
        });
    });

    // Step 3: Handle Promise resolution
    Promise.all(queries)
        .then(() => res.status(201).send({ message: "እቅዱ ወደ መረጃ ቋት ገብቷል፣ ተመሳሳይነት ያላችው የሉም።" }))
        .catch(error => {
            console.error("እቅዱን ለማስገባት አለተቻለም።", error);
            res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
        });
});
    
    // Fetch Plans
    app.get("/old_plans", (req, res) => {
        db.query('SELECT * FROM plan_old', (error, results) => {
            if (error) {
                console.error("የመረጃ ቋት ችግር:", error);
                return res.status(500).json({ message: "እቅዱን ማግኘት አልተቻለም።" });
            }
    
            if (!results || results.length === 0) {
                console.warn("ምንም የእቅድ ዝርዝር የለም።");
                return res.json([]);
            }
    
            console.log("የተዘረዘሩ እቅዶች:", results); // Debugging log
    
            const plans = results.map(plan => ({
                id: plan.id,
                type: plan.type,
                quantity: plan.quantity,
                checkboxes: [
                    plan.meskerem, plan.tikimt, plan.hidar, plan.tahsas,
                    plan.tir, plan.yekatit, plan.megabit, plan.miyazya,
                    plan.ginbot, plan.sene, plan.hamle, plan.nehase
                ]
            }));
    
            res.json(plans);
        });
    });
    
    // Delete Plan
    app.delete("/old_plans/:id", (req, res) => {

        db.query("DELETE FROM plan_old WHERE id = ?", [req.params.id], (error) => {
            if (error) {
                return res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
            }
            res.status(200).send({ message: "እቅዱ ተስርዟል!" });
        });
    });




    // Save Train_Plans
app.post("/train_plan_save", (req, res) => {

    const plans = req.body;
    const queries = plans.map(plan => {
        const { type, quantity, checkboxes } = plan;

        return new Promise((resolve, reject) => {
            // Step 1: Check if the row already exists
            const checkQuery = `
                SELECT COUNT(*) AS count FROM plan_train 
                WHERE \`type\` = ? AND quantity = ? AND meskerem = ? AND tikimt = ? AND hidar = ? 
                AND tahsas = ? AND tir = ? AND yekatit = ? AND megabit = ? AND miyazya = ? 
                AND ginbot = ? AND sene = ? AND hamle = ? AND nehase = ?;
            `;

            db.query(checkQuery, [type, quantity, ...checkboxes], (checkError, results) => {
                if (checkError) {
                    reject(checkError);
                    return;
                }

                if (results[0].count > 0) {
                    // Duplicate row found, skip insertion
                    resolve();
                } else {
                    // Step 2: Insert if not duplicate
                    const insertQuery =` 
                        INSERT INTO plan_train (\`type\`, quantity, meskerem, tikimt, hidar, tahsas, tir, yekatit, megabit, miyazya, ginbot, sene, hamle, nehase)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(insertQuery, [type, quantity, ...checkboxes], (insertError) => {
                        if (insertError) reject(insertError);
                        else resolve();
                    });
                }
            });
        });
    });

    // Step 3: Handle Promise resolution
    Promise.all(queries)
        .then(() => res.status(201).send({ message: "እቅዱ ወደ መረጃ ቋት ገብቷል፣ ተመሳሳይነት ያላችው የሉም።" }))
        .catch(error => {
            console.error("እቅዱን ለማስገባት አለተቻለም።", error);
            res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
        });
});
    
    // Fetch Plans
    app.get("/train_plans", (req, res) => {
        db.query('SELECT * FROM plan_train', (error, results) => {
            if (error) {
                console.error("የመረጃ ቋት ችግር:", error);
                return res.status(500).json({ message: "እቅዱን ማግኘት አልተቻለም።" });
            }
    
            if (!results || results.length === 0) {
                console.warn("ምንም የእቅድ ዝርዝር የለም።");
                return res.json([]);
            }
    
            console.log("የተዘረዘሩ እቅዶች:", results); // Debugging log
    
            const plans = results.map(plan => ({
                id: plan.id,
                type: plan.type,
                quantity: plan.quantity,
                checkboxes: [
                    plan.meskerem, plan.tikimt, plan.hidar, plan.tahsas,
                    plan.tir, plan.yekatit, plan.megabit, plan.miyazya,
                    plan.ginbot, plan.sene, plan.hamle, plan.nehase
                ]
            }));
    
            res.json(plans);
        });
    });
    
    // Delete Plan
    app.delete("/train_plans/:id", (req, res) => {


        db.query("DELETE FROM plan_train WHERE id = ?", [req.params.id], (error) => {
            if (error) {
                return res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
            }
            res.status(200).send({ message: "እቅዱ ተስርዟል!" });
        });
    });



// Save Research_Plans
app.post("/research_plan_save", (req, res) => {

    const plans = req.body;
    const queries = plans.map(plan => {
        const { type, quantity, checkboxes } = plan;

        return new Promise((resolve, reject) => {
            // Step 1: Check if the row already exists
            const checkQuery = `
                SELECT COUNT(*) AS count FROM plan_research 
                WHERE \`type\` = ? AND quantity = ? AND meskerem = ? AND tikimt = ? AND hidar = ? 
                AND tahsas = ? AND tir = ? AND yekatit = ? AND megabit = ? AND miyazya = ? 
                AND ginbot = ? AND sene = ? AND hamle = ? AND nehase = ?;
            `;

            db.query(checkQuery, [type, quantity, ...checkboxes], (checkError, results) => {
                if (checkError) {
                    reject(checkError);
                    return;
                }

                if (results[0].count > 0) {
                    // Duplicate row found, skip insertion
                    resolve();
                } else {
                    // Step 2: Insert if not duplicate
                    const insertQuery =` 
                        INSERT INTO plan_research (\`type\`, quantity, meskerem, tikimt, hidar, tahsas, tir, yekatit, megabit, miyazya, ginbot, sene, hamle, nehase)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(insertQuery, [type, quantity, ...checkboxes], (insertError) => {
                        if (insertError) reject(insertError);
                        else resolve();
                    });
                }
            });
        });
    });

    // Step 3: Handle Promise resolution
    Promise.all(queries)
        .then(() => res.status(201).send({ message: "እቅዱ ወደ መረጃ ቋት ገብቷል፣ ተመሳሳይነት ያላችው የሉም።" }))
        .catch(error => {
            console.error("እቅዱን ለማስገባት አለተቻለም።", error);
            res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
        });
});
    
    // Fetch Plans
    app.get("/research_plans", (req, res) => {
        db.query('SELECT * FROM plan_research', (error, results) => {
            if (error) {
                console.error("የመረጃ ቋት ችግር:", error);
                return res.status(500).json({ message: "እቅዱን ማግኘት አልተቻለም።" });
            }
    
            if (!results || results.length === 0) {
                console.warn("ምንም የእቅድ ዝርዝር የለም።");
                return res.json([]);
            }
    
            console.log("የተዘረዘሩ እቅዶች:", results); // Debugging log
    
            const plans = results.map(plan => ({
                id: plan.id,
                type: plan.type,
                quantity: plan.quantity,
                checkboxes: [
                    plan.meskerem, plan.tikimt, plan.hidar, plan.tahsas,
                    plan.tir, plan.yekatit, plan.megabit, plan.miyazya,
                    plan.ginbot, plan.sene, plan.hamle, plan.nehase
                ]
            }));
    
            res.json(plans);
        });
    });
    
    // Delete Plan
    app.delete("/research_plans/:id", (req, res) => {

        db.query("DELETE FROM plan_research WHERE id = ?", [req.params.id], (error) => {
            if (error) {
                return res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
            }
            res.status(200).send({ message: "እቅዱ ተስርዟል!" });
        });
    });




// Save Out_Plans
app.post("/out_plan_save", (req, res) => {

    const plans = req.body;
    const queries = plans.map(plan => {
        const { type, quantity, checkboxes } = plan;

        return new Promise((resolve, reject) => {
            // Step 1: Check if the row already exists
            const checkQuery = `
                SELECT COUNT(*) AS count FROM plan_out
                WHERE \`type\` = ? AND quantity = ? AND meskerem = ? AND tikimt = ? AND hidar = ? 
                AND tahsas = ? AND tir = ? AND yekatit = ? AND megabit = ? AND miyazya = ? 
                AND ginbot = ? AND sene = ? AND hamle = ? AND nehase = ?;
            `;

            db.query(checkQuery, [type, quantity, ...checkboxes], (checkError, results) => {
                if (checkError) {
                    reject(checkError);
                    return;
                }

                if (results[0].count > 0) {
                    // Duplicate row found, skip insertion
                    resolve();
                } else {
                    // Step 2: Insert if not duplicate
                    const insertQuery =` 
                        INSERT INTO plan_out (\`type\`, quantity, meskerem, tikimt, hidar, tahsas, tir, yekatit, megabit, miyazya, ginbot, sene, hamle, nehase)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(insertQuery, [type, quantity, ...checkboxes], (insertError) => {
                        if (insertError) reject(insertError);
                        else resolve();
                    });
                }
            });
        });
    });

    // Step 3: Handle Promise resolution
    Promise.all(queries)
        .then(() => res.status(201).send({ message: "እቅዱ ወደ መረጃ ቋት ገብቷል፣ ተመሳሳይነት ያላችው የሉም።" }))
        .catch(error => {
            console.error("እቅዱን ለማስገባት አለተቻለም።", error);
            res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
        });
});
    
    // Fetch Plans
    app.get("/out_plans", (req, res) => {
        db.query('SELECT * FROM plan_out', (error, results) => {
            if (error) {
                console.error("የመረጃ ቋት ችግር:", error);
                return res.status(500).json({ message: "እቅዱን ማግኘት አልተቻለም።" });
            }
    
            if (!results || results.length === 0) {
                console.warn("ምንም የእቅድ ዝርዝር የለም።");
                return res.json([]);
            }
    
            console.log("የተዘረዘሩ እቅዶች:", results); // Debugging log
    
            const plans = results.map(plan => ({
                id: plan.id,
                type: plan.type,
                quantity: plan.quantity,
                checkboxes: [
                    plan.meskerem, plan.tikimt, plan.hidar, plan.tahsas,
                    plan.tir, plan.yekatit, plan.megabit, plan.miyazya,
                    plan.ginbot, plan.sene, plan.hamle, plan.nehase
                ]
            }));
    
            res.json(plans);
        });
    });
    
    // Delete Plan
    app.delete("/out_plans/:id", (req, res) => {

        db.query("DELETE FROM plan_out WHERE id = ?", [req.params.id], (error) => {
            if (error) {
                return res.status(500).send({ message: "የውስጥ የሰርቨር ችግር!" });
            }
            res.status(200).send({ message: "እቅዱ ተስርዟል!" });
        });
    });





// the fetch report code starts here

// Save main reports without clearing existing records
app.post("/main_report_save", (req, res) => {

    const reports = req.body;

    // Filter out empty reports
    const filteredReports = reports.filter(report => 
        report.type || report.planned || report.completed || report.remark
    );

    // Insert new records
    const insertPromises = filteredReports.map(report => {
        return new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO report_main(የእቅዱ_አይነት, የታቀደው_መጠን, የተሰራው_መጠን, ምርመራ) VALUES(?, ?, ?, ?)', 
                [report.type, report.planned, report.completed, report.remark],
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                }
            );
        });
    });

    Promise.all(insertPromises)
        .then(() => {
            res.json({ message: "ሪፖርቱ ወደ መረጃ ቋት ገብቷል!" });
        })
        .catch(error => {
            console.error("ሪፖርቱን ማስገባት አልተቻለም።", error);
            res.status(500).json({ message: "ሪፖርቱን ማስገባት አልተቻለም።" });
        });
});

// Fetch main reports
app.get("/main_reports", (req, res) => {
    db.query('SELECT * FROM report_main', (err, results) => {
        if (err) {
            console.error("ሪፖርቱን ማግኘት አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን ማግኘት አልተቻለም!" });
        }
        res.json(results);
    });
});

// Delete main report by ID
app.delete("/main_reports/:id", (req, res) => {

    const id = parseInt(req.params.id);

    db.query('DELETE FROM report_main WHERE id = ?', [id], (err) => {
        if (err) {
            console.error("ሪፖርቱን መሰረዝ አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን መሰረዝ አልተቻለም!" });
        }
        res.json({ message: "ሪፖርቱ በተሳካ ሁኔታ ተሰርዟል!" });
    });
});




// Save education reports without clearing existing records
app.post("/education_report_save", (req, res) => {

    const reports = req.body;

    // Filter out empty reports
    const filteredReports = reports.filter(report => 
        report.type || report.planned || report.completed || report.remark
    );

    // Insert new records
    const insertPromises = filteredReports.map(report => {
        return new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO report_education(የእቅዱ_አይነት, የታቀደው_መጠን, የተሰራው_መጠን, ምርመራ) VALUES(?, ?, ?, ?)', 
                [report.type, report.planned, report.completed, report.remark],
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                }
            );
        });
    });

    Promise.all(insertPromises)
        .then(() => {
            res.json({ message: "ሪፖርቱ ወደ መረጃ ቋት ገብቷል!!" });
        })
        .catch(error => {
            console.error("ሪፖርቱን ማስገባት አልተቻለም።", error);
            res.status(500).json({ message: "ሪፖርቱን ማስገባት አልተቻለም።!" });
        });
});

// Fetch education reports
app.get("/education_reports", (req, res) => {
    db.query('SELECT * FROM report_education', (err, results) => {
        if (err) {
            console.error("ሪፖርቱን ማግኘት አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን ማግኘት አልተቻለም!" });
        }
        res.json(results);
    });
});

// Delete education report by ID
app.delete("/education_reports/:id", (req, res) => {

    const id = parseInt(req.params.id);

    db.query('DELETE FROM report_education WHERE id = ?', [id], (err) => {
        if (err) {
            console.error("ሪፖርቱን መሰረዝ አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን መሰረዝ አልተቻለም!" });
        }
        res.json({ message: "ሪፖርቱ በተሳካ ሁኔታ ተሰርዟል!" });
    });
});



// Save music reports without clearing existing records
app.post("/music_report_save", (req, res) => {

    const reports = req.body;

    // Filter out empty reports
    const filteredReports = reports.filter(report => 
        report.type || report.planned || report.completed || report.remark
    );

    // Insert new records
    const insertPromises = filteredReports.map(report => {
        return new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO report_music(የእቅዱ_አይነት, የታቀደው_መጠን, የተሰራው_መጠን, ምርመራ) VALUES(?, ?, ?, ?)', 
                [report.type, report.planned, report.completed, report.remark],
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                }
            );
        });
    });

    Promise.all(insertPromises)
        .then(() => {
            res.json({ message: "ሪፖርቱ ወደ መረጃ ቋት ገብቷል!!" });
        })
        .catch(error => {
            console.error("ሪፖርቱን ማስገባት አልተቻለም።", error);
            res.status(500).json({ message: "ሪፖርቱን ማስገባት አልተቻለም።!" });
        });
});

// Fetch music reports
app.get("/music_reports", (req, res) => {
    db.query('SELECT * FROM report_music', (err, results) => {
        if (err) {
            console.error("ሪፖርቱን ማግኘት አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን ማግኘት አልተቻለም!" });
        }
        res.json(results);
    });
});

// Delete music report by ID
app.delete("/music_reports/:id", (req, res) => {

    const id = parseInt(req.params.id);

    db.query('DELETE FROM report_music WHERE id = ?', [id], (err) => {
        if (err) {
            console.error("ሪፖርቱን መሰረዝ አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን መሰረዝ አልተቻለም!" });
        }
        res.json({ message: "ሪፖርቱ በተሳካ ሁኔታ ተሰርዟል!" });
    });
});



// Save art reports without clearing existing records
app.post("/art_report_save", (req, res) => {

    const reports = req.body;

    // Filter out empty reports
    const filteredReports = reports.filter(report => 
        report.type || report.planned || report.completed || report.remark
    );

    // Insert new records
    const insertPromises = filteredReports.map(report => {
        return new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO report_art(የእቅዱ_አይነት, የታቀደው_መጠን, የተሰራው_መጠን, ምርመራ) VALUES(?, ?, ?, ?)', 
                [report.type, report.planned, report.completed, report.remark],
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                }
            );
        });
    });

    Promise.all(insertPromises)
        .then(() => {
            res.json({ message: "ሪፖርቱ ወደ መረጃ ቋት ገብቷል!!" });
        })
        .catch(error => {
            console.error("ሪፖርቱን ማስገባት አልተቻለም።", error);
            res.status(500).json({ message: "ሪፖርቱን ማስገባት አልተቻለም።!" });
        });
});

// Fetch art reports
app.get("/art_reports", (req, res) => {
    db.query('SELECT * FROM report_art', (err, results) => {
        if (err) {
            console.error("ሪፖርቱን ማግኘት አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን ማግኘት አልተቻለም!" });
        }
        res.json(results);
    });
});

// Delete art report by ID
app.delete("/art_reports/:id", (req, res) => {

    const id = parseInt(req.params.id);

    db.query('DELETE FROM report_art WHERE id = ?', [id], (err) => {
        if (err) {
            console.error("ሪፖርቱን መሰረዝ አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን መሰረዝ አልተቻለም!" });
        }
        res.json({ message: "ሪፖርቱ በተሳካ ሁኔታ ተሰርዟል!" });
    });
});



// Save development reports without clearing existing records
app.post("/development_report_save", (req, res) => {

    const reports = req.body;

    // Filter out empty reports
    const filteredReports = reports.filter(report => 
        report.type || report.planned || report.completed || report.remark
    );

    // Insert new records
    const insertPromises = filteredReports.map(report => {
        return new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO report_development(የእቅዱ_አይነት, የታቀደው_መጠን, የተሰራው_መጠን, ምርመራ) VALUES(?, ?, ?, ?)', 
                [report.type, report.planned, report.completed, report.remark],
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                }
            );
        });
    });

    Promise.all(insertPromises)
        .then(() => {
            res.json({ message: "ሪፖርቱ ወደ መረጃ ቋት ገብቷል!!" });
        })
        .catch(error => {
            console.error("ሪፖርቱን ማስገባት አልተቻለም።", error);
            res.status(500).json({ message: "ሪፖርቱን ማስገባት አልተቻለም።!" });
        });
});

// Fetch development reports
app.get("/development_reports", (req, res) => {
    db.query('SELECT * FROM report_development', (err, results) => {
        if (err) {
            console.error("ሪፖርቱን ማግኘት አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን ማግኘት አልተቻለም!" });
        }
        res.json(results);
    });
});

// Delete development report by ID
app.delete("/development_reports/:id", (req, res) => {

    const id = parseInt(req.params.id);

    db.query('DELETE FROM report_development WHERE id = ?', [id], (err) => {
        if (err) {
            console.error("ሪፖርቱን መሰረዝ አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን መሰረዝ አልተቻለም!" });
        }
        res.json({ message: "ሪፖርቱ በተሳካ ሁኔታ ተሰርዟል!" });
    });
});



// Save communication reports without clearing existing records
app.post("/communication_report_save", (req, res) => {

    const reports = req.body;

    // Filter out empty reports
    const filteredReports = reports.filter(report => 
        report.type || report.planned || report.completed || report.remark
    );

    // Insert new records
    const insertPromises = filteredReports.map(report => {
        return new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO report_communication(የእቅዱ_አይነት, የታቀደው_መጠን, የተሰራው_መጠን, ምርመራ) VALUES(?, ?, ?, ?)', 
                [report.type, report.planned, report.completed, report.remark],
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                }
            );
        });
    });

    Promise.all(insertPromises)
        .then(() => {
            res.json({ message: "ሪፖርቱ ወደ መረጃ ቋት ገብቷል!!" });
        })
        .catch(error => {
            console.error("ሪፖርቱን ማስገባት አልተቻለም።", error);
            res.status(500).json({ message: "ሪፖርቱን ማስገባት አልተቻለም።!" });
        });
});

// Fetch communication reports
app.get("/communication_reports", (req, res) => {
    db.query('SELECT * FROM report_communication', (err, results) => {
        if (err) {
            console.error("ሪፖርቱን ማግኘት አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን ማግኘት አልተቻለም!" });
        }
        res.json(results);
    });
});

// Delete communication report by ID
app.delete("/communication_reports/:id", (req, res) => {

    const id = parseInt(req.params.id);

    db.query('DELETE FROM report_communication WHERE id = ?', [id], (err) => {
        if (err) {
            console.error("ሪፖርቱን መሰረዝ አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን መሰረዝ አልተቻለም!" });
        }
        res.json({ message: "ሪፖርቱ በተሳካ ሁኔታ ተሰርዟል!" });
    });
});



// Save aid reports without clearing existing records
app.post("/aid_report_save", (req, res) => {

    const reports = req.body;

    // Filter out empty reports
    const filteredReports = reports.filter(report => 
        report.type || report.planned || report.completed || report.remark
    );

    // Insert new records
    const insertPromises = filteredReports.map(report => {
        return new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO report_aid(የእቅዱ_አይነት, የታቀደው_መጠን, የተሰራው_መጠን, ምርመራ) VALUES(?, ?, ?, ?)', 
                [report.type, report.planned, report.completed, report.remark],
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                }
            );
        });
    });

    Promise.all(insertPromises)
        .then(() => {
            res.json({ message: "ሪፖርቱ ወደ መረጃ ቋት ገብቷል!!" });
        })
        .catch(error => {
            console.error("ሪፖርቱን ማስገባት አልተቻለም።", error);
            res.status(500).json({ message: "ሪፖርቱን ማስገባት አልተቻለም።!" });
        });
});

// Fetch aid reports
app.get("/aid_reports", (req, res) => {
    db.query('SELECT * FROM report_aid', (err, results) => {
        if (err) {
            console.error("ሪፖርቱን ማግኘት አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን ማግኘት አልተቻለም!" });
        }
        res.json(results);
    });
});

// Delete aid report by ID
app.delete("/aid_reports/:id", (req, res) => {

    const id = parseInt(req.params.id);

    db.query('DELETE FROM report_aid WHERE id = ?', [id], (err) => {
        if (err) {
            console.error("ሪፖርቱን መሰረዝ አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን መሰረዝ አልተቻለም!" });
        }
        res.json({ message: "ሪፖርቱ በተሳካ ሁኔታ ተሰርዟል!" });
    });
});



// Save documentation reports without clearing existing records
app.post("/documentation_report_save", (req, res) => {

    const reports = req.body;

    // Filter out empty reports
    const filteredReports = reports.filter(report => 
        report.type || report.planned || report.completed || report.remark
    );

    // Insert new records
    const insertPromises = filteredReports.map(report => {
        return new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO report_documentation(የእቅዱ_አይነት, የታቀደው_መጠን, የተሰራው_መጠን, ምርመራ) VALUES(?, ?, ?, ?)', 
                [report.type, report.planned, report.completed, report.remark],
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                }
            );
        });
    });

    Promise.all(insertPromises)
        .then(() => {
            res.json({ message: "ሪፖርቱ ወደ መረጃ ቋት ገብቷል!!" });
        })
        .catch(error => {
            console.error("ሪፖርቱን ማስገባት አልተቻለም።", error);
            res.status(500).json({ message: "ሪፖርቱን ማስገባት አልተቻለም።!" });
        });
});

// Fetch documentation reports
app.get("/documentation_reports", (req, res) => {
    db.query('SELECT * FROM report_documentation', (err, results) => {
        if (err) {
            console.error("ሪፖርቱን ማግኘት አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን ማግኘት አልተቻለም!" });
        }
        res.json(results);
    });
});

// Delete documentation report by ID
app.delete("/documentation_reports/:id", (req, res) => {

    const id = parseInt(req.params.id);

    db.query('DELETE FROM report_documentation WHERE id = ?', [id], (err) => {
        if (err) {
            console.error("ሪፖርቱን መሰረዝ አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን መሰረዝ አልተቻለም!" });
        }
        res.json({ message: "ሪፖርቱ በተሳካ ሁኔታ ተሰርዟል!" });
    });
});



// Save kid reports without clearing existing records
app.post("/kid_report_save", (req, res) => {

    const reports = req.body;

    // Filter out empty reports
    const filteredReports = reports.filter(report => 
        report.type || report.planned || report.completed || report.remark
    );

    // Insert new records
    const insertPromises = filteredReports.map(report => {
        return new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO report_kid(የእቅዱ_አይነት, የታቀደው_መጠን, የተሰራው_መጠን, ምርመራ) VALUES(?, ?, ?, ?)', 
                [report.type, report.planned, report.completed, report.remark],
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                }
            );
        });
    });

    Promise.all(insertPromises)
        .then(() => {
            res.json({ message: "ሪፖርቱ ወደ መረጃ ቋት ገብቷል!!" });
        })
        .catch(error => {
            console.error("ሪፖርቱን ማስገባት አልተቻለም።", error);
            res.status(500).json({ message: "ሪፖርቱን ማስገባት አልተቻለም።!" });
        });
});

// Fetch kid reports
app.get("/kid_reports", (req, res) => {
    db.query('SELECT * FROM report_kid', (err, results) => {
        if (err) {
            console.error("ሪፖርቱን ማግኘት አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን ማግኘት አልተቻለም!" });
        }
        res.json(results);
    });
});

// Delete kid report by ID
app.delete("/kid_reports/:id", (req, res) => {

    const id = parseInt(req.params.id);

    db.query('DELETE FROM report_kid WHERE id = ?', [id], (err) => {
        if (err) {
            console.error("ሪፖርቱን መሰረዝ አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን መሰረዝ አልተቻለም!" });
        }
        res.json({ message: "ሪፖርቱ በተሳካ ሁኔታ ተሰርዟል!" });
    });
});



// Save old reports without clearing existing records
app.post("/old_report_save", (req, res) => {

    const reports = req.body;

    // Filter out empty reports
    const filteredReports = reports.filter(report => 
        report.type || report.planned || report.completed || report.remark
    );

    // Insert new records
    const insertPromises = filteredReports.map(report => {
        return new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO report_old(የእቅዱ_አይነት, የታቀደው_መጠን, የተሰራው_መጠን, ምርመራ) VALUES(?, ?, ?, ?)', 
                [report.type, report.planned, report.completed, report.remark],
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                }
            );
        });
    });

    Promise.all(insertPromises)
        .then(() => {
            res.json({ message: "ሪፖርቱ ወደ መረጃ ቋት ገብቷል!!" });
        })
        .catch(error => {
            console.error("ሪፖርቱን ማስገባት አልተቻለም።", error);
            res.status(500).json({ message: "ሪፖርቱን ማስገባት አልተቻለም።!" });
        });
});

// Fetch old reports
app.get("/old_reports", (req, res) => {
    db.query('SELECT * FROM report_old', (err, results) => {
        if (err) {
            console.error("ሪፖርቱን ማግኘት አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን ማግኘት አልተቻለም!" });
        }
        res.json(results);
    });
});

// Delete old report by ID
app.delete("/old_reports/:id", (req, res) => {

    const id = parseInt(req.params.id);

    db.query('DELETE FROM report_old WHERE id = ?', [id], (err) => {
        if (err) {
            console.error("ሪፖርቱን መሰረዝ አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን መሰረዝ አልተቻለም!" });
        }
        res.json({ message: "ሪፖርቱ በተሳካ ሁኔታ ተሰርዟል!" });
    });
});



// Save train reports without clearing existing records
app.post("/train_report_save", (req, res) => {

    const reports = req.body;

    // Filter out empty reports
    const filteredReports = reports.filter(report => 
        report.type || report.planned || report.completed || report.remark
    );

    // Insert new records
    const insertPromises = filteredReports.map(report => {
        return new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO report_train(የእቅዱ_አይነት, የታቀደው_መጠን, የተሰራው_መጠን, ምርመራ) VALUES(?, ?, ?, ?)', 
                [report.type, report.planned, report.completed, report.remark],
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                }
            );
        });
    });

    Promise.all(insertPromises)
        .then(() => {
            res.json({ message: "ሪፖርቱ ወደ መረጃ ቋት ገብቷል!!" });
        })
        .catch(error => {
            console.error("ሪፖርቱን ማስገባት አልተቻለም።", error);
            res.status(500).json({ message: "ሪፖርቱን ማስገባት አልተቻለም።!" });
        });
});

// Fetch train reports
app.get("/train_reports", (req, res) => {
    db.query('SELECT * FROM report_train', (err, results) => {
        if (err) {
            console.error("ሪፖርቱን ማግኘት አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን ማግኘት አልተቻለም!" });
        }
        res.json(results);
    });
});

// Delete train report by ID
app.delete("/train_reports/:id", (req, res) => {

    const id = parseInt(req.params.id);

    db.query('DELETE FROM report_train WHERE id = ?', [id], (err) => {
        if (err) {
            console.error("ሪፖርቱን መሰረዝ አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን መሰረዝ አልተቻለም!" });
        }
        res.json({ message: "ሪፖርቱ በተሳካ ሁኔታ ተሰርዟል!" });
    });
});



// Save research reports without clearing existing records
app.post("/research_report_save", (req, res) => {

    const reports = req.body;

    // Filter out empty reports
    const filteredReports = reports.filter(report => 
        report.type || report.planned || report.completed || report.remark
    );

    // Insert new records
    const insertPromises = filteredReports.map(report => {
        return new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO report_research(የእቅዱ_አይነት, የታቀደው_መጠን, የተሰራው_መጠን, ምርመራ) VALUES(?, ?, ?, ?)', 
                [report.type, report.planned, report.completed, report.remark],
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                }
            );
        });
    });

    Promise.all(insertPromises)
        .then(() => {
            res.json({ message: "ሪፖርቱ ወደ መረጃ ቋት ገብቷል!!" });
        })
        .catch(error => {
            console.error("ሪፖርቱን ማስገባት አልተቻለም።", error);
            res.status(500).json({ message: "ሪፖርቱን ማስገባት አልተቻለም።!" });
        });
});

// Fetch research reports
app.get("/research_reports", (req, res) => {
    db.query('SELECT * FROM report_research', (err, results) => {
        if (err) {
            console.error("ሪፖርቱን ማግኘት አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን ማግኘት አልተቻለም!" });
        }
        res.json(results);
    });
});

// Delete research report by ID
app.delete("/research_reports/:id", (req, res) => {

    const id = parseInt(req.params.id);

    db.query('DELETE FROM report_research WHERE id = ?', [id], (err) => {
        if (err) {
            console.error("ሪፖርቱን መሰረዝ አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን መሰረዝ አልተቻለም!" });
        }
        res.json({ message: "ሪፖርቱ በተሳካ ሁኔታ ተሰርዟል!" });
    });
});



// Save out reports without clearing existing records
app.post("/out_report_save", (req, res) => {

    const reports = req.body;

    // Filter out empty reports
    const filteredReports = reports.filter(report => 
        report.type || report.planned || report.completed || report.remark
    );

    // Insert new records
    const insertPromises = filteredReports.map(report => {
        return new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO report_out(የእቅዱ_አይነት, የታቀደው_መጠን, የተሰራው_መጠን, ምርመራ) VALUES(?, ?, ?, ?)', 
                [report.type, report.planned, report.completed, report.remark],
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                }
            );
        });
    });

    Promise.all(insertPromises)
        .then(() => {
            res.json({ message: "ሪፖርቱ ወደ መረጃ ቋት ገብቷል!!" });
        })
        .catch(error => {
            console.error("ሪፖርቱን ማስገባት አልተቻለም።", error);
            res.status(500).json({ message: "ሪፖርቱን ማስገባት አልተቻለም።!" });
        });
});

// Fetch out reports
app.get("/out_reports", (req, res) => {
    db.query('SELECT * FROM report_out', (err, results) => {
        if (err) {
            console.error("ሪፖርቱን ማግኘት አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን ማግኘት አልተቻለም!" });
        }
        res.json(results);
    });
});

// Delete out report by ID
app.delete("/out_reports/:id", (req, res) => {

    const id = parseInt(req.params.id);

    db.query('DELETE FROM report_out WHERE id = ?', [id], (err) => {
        if (err) {
            console.error("ሪፖርቱን መሰረዝ አልተቻለም።", err);
            return res.status(500).json({ message: "ሪፖርቱን መሰረዝ አልተቻለም!" });
        }
        res.json({ message: "ሪፖርቱ በተሳካ ሁኔታ ተሰርዟል!" });
    });
});




//the kid course registration page fetch starts here
// Endpoint to submit kid one registration
app.post('/submit_kid_one', (req, res) => {

    const { name, fathername, grandfathername, baptismname, parent, parentTwo, age, phonenumber, phonenumberTwo  } = req.body;
    const sql = 'INSERT INTO kid_one_course (name, fathername, grandfathername, baptismname, parent, parentTwo, age, phonenumber, phonenumberTwo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, [name, fathername, grandfathername, baptismname, parent, parentTwo, age, phonenumber, phonenumberTwo], (err) => {
        if (err) throw err;
        res.json({ message: 'የተሳካ ምዝገባ ተከናውኗል!' });
    });
});

// Endpoint to get all kid_one registrations
app.get('/kid_one_course', (req, res) => {
    db.query('SELECT * FROM kid_one_course', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to delete a kid_one registration
app.delete('/kid_one_course/:id', (req, res) => {

    const sql = 'DELETE FROM kid_one_course WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.json({ message: 'ምዝገባው ተሰርዟል!' });
    });
});





// Endpoint to submit kid two registration
app.post('/submit_kid_two', (req, res) => {

    const { name, fathername, grandfathername, baptismname, parent, parentTwo, age, phonenumber, phonenumberTwo  } = req.body;
    const sql = 'INSERT INTO kid_two_course (name, fathername, grandfathername, baptismname, parent, parentTwo, age, phonenumber, phonenumberTwo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, [name, fathername, grandfathername, baptismname, parent, parentTwo, age, phonenumber, phonenumberTwo], (err) => {
        if (err) throw err;
        res.json({ message: 'የተሳካ ምዝገባ ተከናውኗል!' });
    });
});

// Endpoint to get all kid_two registrations
app.get('/kid_two_course', (req, res) => {
    db.query('SELECT * FROM kid_two_course', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to delete a kid_two registration
app.delete('/kid_two_course/:id', (req, res) => {

    const sql = 'DELETE FROM kid_two_course WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.json({ message: 'ምዝገባው ተሰርዟል!' });
    });
});





// Endpoint to submit kid three registration
app.post('/submit_kid_three', (req, res) => {

    const { name, fathername, grandfathername, baptismname, parent, parentTwo, age, phonenumber, phonenumberTwo  } = req.body;
    const sql = 'INSERT INTO kid_three_course (name, fathername, grandfathername, baptismname, parent, parentTwo, age, phonenumber, phonenumberTwo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, [name, fathername, grandfathername, baptismname, parent, parentTwo, age, phonenumber, phonenumberTwo], (err) => {
        if (err) throw err;
        res.json({ message: 'የተሳካ ምዝገባ ተከናውኗል!' });
    });
});

// Endpoint to get all kid_three registrations
app.get('/kid_three_course', (req, res) => {
    db.query('SELECT * FROM kid_three_course', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to delete a kid_three registration
app.delete('/kid_three_course/:id', (req, res) => {

    const sql = 'DELETE FROM kid_three_course WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.json({ message: 'ምዝገባው ተሰርዟል!' });
    });
});




// Endpoint to submit kid four registration
app.post('/submit_kid_four', (req, res) => {

    const { name, fathername, grandfathername, baptismname, parent, parentTwo, age, phonenumber, phonenumberTwo  } = req.body;
    const sql = 'INSERT INTO kid_four_course (name, fathername, grandfathername, baptismname, parent, parentTwo, age, phonenumber, phonenumberTwo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, [name, fathername, grandfathername, baptismname, parent, parentTwo, age, phonenumber, phonenumberTwo], (err) => {
        if (err) throw err;
        res.json({ message: 'የተሳካ ምዝገባ ተከናውኗል!' });
    });
});

// Endpoint to get all kid_four registrations
app.get('/kid_four_course', (req, res) => {
    db.query('SELECT * FROM kid_four_course', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to delete a kid_four registration
app.delete('/kid_four_course/:id', (req, res) => {

    const sql = 'DELETE FROM kid_four_course WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.json({ message: 'ምዝገባው ተሰርዟል!' });
    });
});





// Endpoint to submit kid five registration
app.post('/submit_kid_five', (req, res) => {

    const { name, fathername, grandfathername, baptismname, parent, parentTwo, age, phonenumber, phonenumberTwo  } = req.body;
    const sql = 'INSERT INTO kid_five_course (name, fathername, grandfathername, baptismname, parent, parentTwo, age, phonenumber, phonenumberTwo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, [name, fathername, grandfathername, baptismname, parent, parentTwo, age, phonenumber, phonenumberTwo], (err) => {
        if (err) throw err;
        res.json({ message: 'የተሳካ ምዝገባ ተከናውኗል!' });
    });
});

// Endpoint to get all kid_five registrations
app.get('/kid_five_course', (req, res) => {
    db.query('SELECT * FROM kid_five_course', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to delete a kid_five registration
app.delete('/kid_five_course/:id', (req, res) => {

    const sql = 'DELETE FROM kid_five_course WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.json({ message: 'ምዝገባው ተሰርዟል!' });
    });
});








//the education department course registration page fetch starts here
// Endpoint to submit kedamay one registration
app.post('/submit_kedamay_one', (req, res) => {

    const { name, fathername, grandfathername, baptismname, age, phonenumber  } = req.body;
    const sql = 'INSERT INTO kedamay_course (name, fathername, grandfathername, baptismname, age, phonenumber) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [name, fathername, grandfathername, baptismname, age, phonenumber ], (err) => {
        if (err) throw err;
        res.json({ message: 'የተሳካ ምዝገባ ተከናውኗል!' });
    });
});

// Endpoint to get all kedamay_one registrations
app.get('/kedamay_one_course', (req, res) => {
    db.query('SELECT * FROM kedamay_course', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to delete a kedamay_one registration
app.delete('/kedamay_one_course/:id', (req, res) => {

    const sql = 'DELETE FROM kedamay_course WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.json({ message: 'ምዝገባው ተሰርዟል!' });
    });
});



// Endpoint to submit kalay two registration
app.post('/submit_kalay_two', (req, res) => {

    const { name, fathername, grandfathername, baptismname, age, phonenumber  } = req.body;
    const sql = 'INSERT INTO kalay_course (name, fathername, grandfathername, baptismname, age, phonenumber) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [name, fathername, grandfathername, baptismname, age, phonenumber ], (err) => {
        if (err) throw err;
        res.json({ message: 'የተሳካ ምዝገባ ተከናውኗል!' });
    });
});

// Endpoint to get all kalay_two registrations
app.get('/kalay_two_course', (req, res) => {
    db.query('SELECT * FROM kalay_course', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to delete a kalay_two registration
app.delete('/kalay_two_course/:id', (req, res) => {

    const sql = 'DELETE FROM kalay_course WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.json({ message: 'ምዝገባው ተሰርዟል!' });
    });
});




// Endpoint to submit salsay three registration
app.post('/submit_salsay_three', (req, res) => {

    const { name, fathername, grandfathername, baptismname, age, phonenumber  } = req.body;
    const sql = 'INSERT INTO salsay_course (name, fathername, grandfathername, baptismname, age, phonenumber) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [name, fathername, grandfathername, baptismname, age, phonenumber ], (err) => {
        if (err) throw err;
        res.json({ message: 'የተሳካ ምዝገባ ተከናውኗል!' });
    });
});

// Endpoint to get all salsay_three registrations
app.get('/salsay_three_course', (req, res) => {
    db.query('SELECT * FROM salsay_course', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to delete a salsay_three registration
app.delete('/salsay_three_course/:id', (req, res) => {

    const sql = 'DELETE FROM salsay_course WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.json({ message: 'ምዝገባው ተሰርዟል!' });
    });
});




// Endpoint to submit rabay four registration
app.post('/submit_rabay_four', (req, res) => {

    const { name, fathername, grandfathername, baptismname, age, phonenumber  } = req.body;
    const sql = 'INSERT INTO rabay_course (name, fathername, grandfathername, baptismname, age, phonenumber) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [name, fathername, grandfathername, baptismname, age, phonenumber ], (err) => {
        if (err) throw err;
        res.json({ message: 'የተሳካ ምዝገባ ተከናውኗል!' });
    });
});

// Endpoint to get all rabay_four registrations
app.get('/rabay_four_course', (req, res) => {
    db.query('SELECT * FROM rabay_course', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to delete a rabay_four registration
app.delete('/rabay_four_course/:id', (req, res) => {

    const sql = 'DELETE FROM rabay_course WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.json({ message: 'ምዝገባው ተሰርዟል!' });
    });
});




// Endpoint to submit hamsay five registration
app.post('/submit_hamsay_five', (req, res) => {

    const { name, fathername, grandfathername, baptismname, age, phonenumber  } = req.body;
    const sql = 'INSERT INTO hamsay_course (name, fathername, grandfathername, baptismname, age, phonenumber) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [name, fathername, grandfathername, baptismname, age, phonenumber ], (err) => {
        if (err) throw err;
        res.json({ message: 'የተሳካ ምዝገባ ተከናውኗል!' });
    });
});

// Endpoint to get all hamsay_five registrations
app.get('/hamsay_five_course', (req, res) => {
    db.query('SELECT * FROM hamsay_course', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to delete a hamsay_five registration
app.delete('/hamsay_five_course/:id', (req, res) => {

    const sql = 'DELETE FROM hamsay_course WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.json({ message: 'ምዝገባው ተሰርዟል!' });
    });
});



// Endpoint to submit sadsay six registration
app.post('/submit_sadsay_six', (req, res) => {

    const { name, fathername, grandfathername, baptismname, age, phonenumber  } = req.body;
    const sql = 'INSERT INTO sadsay_course (name, fathername, grandfathername, baptismname, age, phonenumber) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [name, fathername, grandfathername, baptismname, age, phonenumber ], (err) => {
        if (err) throw err;
        res.json({ message: 'የተሳካ ምዝገባ ተከናውኗል!' });
    });
});

// Endpoint to get all sadsay_siv registrations
app.get('/sadsay_six_course', (req, res) => {
    db.query('SELECT * FROM sadsay_course', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to delete a sadsay_six registration
app.delete('/sadsay_six_course/:id', (req, res) => {

    const sql = 'DELETE FROM sadsay_course WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.json({ message: 'ምዝገባው ተሰርዟል!' });
    });
});






//the code to fetch the music registration in the directors and own page starts here
// Endpoint to submit kalay music registration
app.post('/submit_kalay_music', (req, res) => {

    const { name, fathername, phonenumber  } = req.body;
    const sql = 'INSERT INTO kalay_music_course (name, fathername, phonenumber) VALUES (?, ?, ?)';
    db.query(sql, [name, fathername, phonenumber ], (err) => {
        if (err) throw err;
        res.json({ message: 'የተሳካ ምዝገባ ተከናውኗል!' });
    });
});

// Endpoint to get all kalay_music registrations
app.get('/kalay_music_course', (req, res) => {
    db.query('SELECT * FROM kalay_music_course', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to delete a kalay_music registration
app.delete('/kalay_music_course/:id', (req, res) => {

    const sql = 'DELETE FROM kalay_music_course WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.json({ message: 'ምዝገባው ተሰርዟል!' });
    });
});




// Endpoint to submit salsay music registration
app.post('/submit_salsay_music', (req, res) => {

    const { name, fathername, phonenumber  } = req.body;
    const sql = 'INSERT INTO salsay_music_course (name, fathername, phonenumber) VALUES (?, ?, ?)';
    db.query(sql, [name, fathername, phonenumber ], (err) => {
        if (err) throw err;
        res.json({ message: 'የተሳካ ምዝገባ ተከናውኗል!' });
    });
});

// Endpoint to get all salsay_music registrations
app.get('/salsay_music_course', (req, res) => {
    db.query('SELECT * FROM salsay_music_course', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to delete a salsay_music registration
app.delete('/salsay_music_course/:id', (req, res) => {

    const sql = 'DELETE FROM salsay_music_course WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.json({ message: 'ምዝገባው ተሰርዟል!' });
    });
});




// Endpoint to submit maekelawyan music registration
app.post('/submit_maekelawyan_music', (req, res) => {

    const { name, fathername, phonenumber  } = req.body;
    const sql = 'INSERT INTO maekelawyan_music_course (name, fathername, phonenumber) VALUES (?, ?, ?)';
    db.query(sql, [name, fathername, phonenumber ], (err) => {
        if (err) throw err;
        res.json({ message: 'የተሳካ ምዝገባ ተከናውኗል!' });
    });
});

// Endpoint to get all maekelawyan_music registrations
app.get('/maekelawyan_music_course', (req, res) => {
    db.query('SELECT * FROM maekelawyan_music_course', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to delete a maekelawyan_music registration
app.delete('/maekelawyan_music_course/:id', (req, res) => {

    const sql = 'DELETE FROM maekelawyan_music_course WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.json({ message: 'ምዝገባው ተሰርዟል!' });
    });
});




// Endpoint to submit kuami music registration
app.post('/submit_kuami_music', (req, res) => {
    
    const { name, fathername, phonenumber  } = req.body;
    const sql = 'INSERT INTO kuami_music_course (name, fathername, phonenumber) VALUES (?, ?, ?)';
    db.query(sql, [name, fathername, phonenumber ], (err) => {
        if (err) throw err;
        res.json({ message: 'የተሳካ ምዝገባ ተከናውኗል!' });
    });
});

// Endpoint to get all kuami_music registrations
app.get('/kuami_music_course', (req, res) => {
    db.query('SELECT * FROM kuami_music_course', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to delete a kuami_music registration
app.delete('/kuami_music_course/:id', (req, res) => {

    const sql = 'DELETE FROM kuami_music_course WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.json({ message: 'ምዝገባው ተሰርዟል!' });
    });
});




//the code to fetch the reports in the directors page starts here
// Endpoint to fetch reports
app.get('/:type_reports', (req, res) => {
    const reportType = req.params.type_reports;

    db.query(`SELECT * FROM report_${reportType}`, (err, results) => {
        if (err) {
            console.error('Error fetching reports:', err);
            return res.status(500).json({ message: 'Error fetching reports' });
        }
        res.json(results);
    });
});

// Endpoint to delete a report
app.delete('/:type_reports/:id', (req, res) => {

    const reportType = req.params.type_reports;
    const reportId = req.params.id;

    db.query(`DELETE FROM report_${reportType} WHERE id = ?`, [reportId], (err, results) => {
        if (err) {
            console.error('Error deleting report:', err);
            return res.status(500).json({ message: 'Error deleting report' });
        }
        res.json({ message: 'Report deleted successfully!' });
    });
});






// code to fetch plan to the main starts here
// Function to handle fetching plans dynamically for various departments
app.get("/:planType_plans", (req, res) => {
    const { planType } = req.params;
    const tableName = `plan_${planType}`;

    db.query(`SELECT * FROM ${tableName}`, (error, results) => {
        if (error) {
            console.error("Error fetching plans:", error);
            return res.status(500).json({ message: "Failed to fetch plans" });
        }

        res.json(results.map(plan => ({
            id: plan.id,
            type: plan.የእቅድ_አይነት, // Assuming your column names are in Amharic
            quantity: plan.ብዛት,
            checkboxes: [
                plan.መስከረም, // Replace with your column names for each month
                plan.ጥቅምት,
                plan.ህዳር,
                plan.ታህሳስ,
                plan.ጥር,
                plan.የካቲት,
                plan.መጋቢት,
                plan.ሚያዝያ,
                plan.ግንቦት,
                plan.ሰኔ,
                plan.ሐምሌ,
                plan.ነሐሴ
            ]
        })));
    });
});

// Delete plan dynamically based on table
app.delete("/:planType_plans/:id", (req, res) => {

    const { planType, id } = req.params;
    const tableName = `plan_${planType}`;

    db.query(`DELETE FROM ${tableName} WHERE id = ?`, [id], (error) => {
        if (error) {
            console.error("Error deleting plan:", error);
            return res.status(500).send({ message: "Internal server error!" });
        }
        res.status(200).send({ message: "Plan deleted successfully!" });
    });
});





// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
