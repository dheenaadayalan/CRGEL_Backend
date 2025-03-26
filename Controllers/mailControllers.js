import nodemailer from "nodemailer";
import { generateOutputProductionReport } from "./oderControllers.js";

const formatReportAsHTML = (reportData) => {
    const { hourlyCount, dailyCount } = reportData;
  
    // Get all production line names from the report (e.g. "Line-1", "Line-2", …)
    const lines = Object.keys(hourlyCount);
  
    // Extract all unique time slots (excluding the "Total" key)
    let timeSlotsSet = new Set();
    for (const line in hourlyCount) {
      for (const timeRange in hourlyCount[line]) {
        if (timeRange !== "Total") {
          timeSlotsSet.add(timeRange);
        }
      }
    }
    let timeSlots = Array.from(timeSlotsSet);
    // Sort time slots by starting hour (assumes a format like "8:00-8:59")
    timeSlots.sort((a, b) => {
      const getHour = (timeRange) => parseInt(timeRange.split(":")[0], 10);
      return getHour(a) - getHour(b);
    });
  
    // Helper: Convert 24-hour time range to a 12-hour IST time range.
    const convert24to12 = (timeRange) => {
      if (timeRange === "Total") return timeRange;
      const [start, end] = timeRange.split("-");
      const convertTime = (time) => {
        let [hour, minute] = time.split(":").map(Number);
        // Convert from assumed UTC to IST by adding 5 hours 30 minutes
        hour += 5;
        minute += 30;
        if (minute >= 60) {
          minute -= 60;
          hour += 1;
        }
        hour = hour % 24;
        const ampm = hour >= 12 ? "PM" : "AM";
        const istHour = hour % 12 || 12;
        return `${istHour}:00 ${ampm}`;
      };
      return `${convertTime(start)} - ${convertTime(end)}`;
    };
  
    // Build table header: first column "Time Slot", then each production line as a column header.
    let tableHeader = `<tr>
        <th style="padding: 8px; border: 1px solid #ddd;">Time Slot</th>
        ${lines.map(line => `<th style="padding: 8px; border: 1px solid #ddd;">${line}</th>`).join('')}
    </tr>`;
  
    // Build table rows for each time slot.
    let tableRows = "";
    for (let ts of timeSlots) {
      tableRows += `<tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${convert24to12(ts)}</td>
        ${lines.map(line => `<td style="padding: 8px; border: 1px solid #ddd;">${hourlyCount[line][ts] || 0}</td>`).join('')}
      </tr>`;
    }
  
    // Add a final row for Totals per production line.
    tableRows += `<tr style="background-color: #176B87; color: white; font-weight: bold;">
        <td style="padding: 8px; border: 1px solid #ddd;">Total</td>
        ${lines.map(line => `<td style="padding: 8px; border: 1px solid #ddd;">${hourlyCount[line]["Total"] || 0}</td>`).join('')}
    </tr>`;
  
    // Build the complete HTML content. Note the viewport meta tag and CSS media query for responsiveness.
    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 100%;
              margin: auto;
              padding: 20px;
              overflow-x: auto;
            }
            .header {
              background-color: #176B87;
              color: white;
              padding: 15px;
              font-size: 24px;
              font-weight: bold;
            }
            .footer {
              margin-top: 20px;
              font-size: 14px;
              color: gray;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: center;
            }
            th {
              background-color: #176B87;
              color: white;
            }
            .button {
              background-color: #176B87;
              color: white;
              padding: 10px 20px;
              text-decoration: none;
              border-radius: 5px;
              display: inline-block;
              margin-top: 20px;
            }
            /* Responsive Styles */
            @media screen and (max-width: 600px) {
              table, thead, tbody, th, td, tr {
                display: block;
              }
              thead tr {
                position: absolute;
                top: -9999px;
                left: -9999px;
              }
              tr {
                border: 1px solid #ccc;
                margin-bottom: 5px;
              }
              td {
                border: none;
                border-bottom: 1px solid #eee;
                position: relative;
                padding-left: 50%;
                text-align: left;
              }
              td:before {
                position: absolute;
                top: 50%;
                left: 6px;
                transform: translateY(-50%);
                white-space: nowrap;
                font-weight: bold;
              }
              /* For each cell, display header info before its value */
              td:nth-of-type(1):before { content: "Time Slot"; }
              ${lines.map((line, index) => {
                // For each production line column, td:nth-of-type(index + 2)
                return `td:nth-of-type(${index + 2}):before { content: "${line}"; }`;
              }).join("\n")}
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">Production Report</div>
            <h2>Today's Total Output: ${dailyCount}</h2>
            <table>
              <thead>
                ${tableHeader}
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
            <a href="https://crgel.uclubs.in/" class="button">View Full Report</a>
            <div class="footer">Powered by CRGEL | <a href="https://crgel.uclubs.in/">Visit Our Website</a></div>
          </div>
        </body>
      </html>
    `;
  };
  
  

export const sendProductionReportEmail = async () => {
  try {
    // Create a fake request object with the proper parameters
    const fakeReq = {
      user: { companyID: "67926980ee5b224d6b13f022" },
      body: {
        status: "Output",
        date: new Date().toISOString(), // today's date
      },
    };

    // Create a fake response object that captures the JSON output from your report function
    let responseData;
    const fakeRes = {
      status: function (statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json: function (data) {
        responseData = data;
        return data;
      },
    };

    // Call the function and wait for the report data to be set in responseData
    await generateOutputProductionReport(fakeReq, fakeRes);

    // responseData should now contain:
    // { message: "Production Report", hourlyCount, dailyCount }
    const reportData = responseData;

    // Format the report into an HTML email using your existing format function
    const htmlContent = formatReportAsHTML(reportData);

    // Configure nodemailer transporter (adjust credentials as needed)
    const transporter = nodemailer.createTransport({
      service: "gmail", // or use your SMTP settings
      auth: {
        user: process.env.EMAIL,
        pass: process.env.APP_PASSWORD,
      },
    });

    // Prepare the email options (you can send to multiple recipients)
    const mailOptions = {
      from: "your-email@gmail.com",
      to: ["dheenadayalan.work@gmail.com","crdhandapani@crgarments.com, crgmerch3@crgarments.com"], 
      subject: "Hourly Production Report",
      html: htmlContent,
    };

    // Send the email
    await transporter.sendMail(mailOptions);
    console.log("Production report email sent successfully!");
  } catch (error) {
    console.error("Error sending production report email:", error);
  }
};
