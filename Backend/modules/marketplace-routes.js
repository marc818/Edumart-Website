import { requireAdmin } from "./authorization.js";

import bcrypt from "bcryptjs";
import multer from "multer";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  VERIFICATION_STATUS,
  approveStudent,
  validateStudentForApproval,
  requireVerifiedStudent,
} from "./verification-service.js";

import {
  LISTING_STATUS,
  approveListing,
  canDisplayListing,
  createListing,
} from "./listing-service.js";


/*
|--------------------------------------------------------------------------
| Utility
|--------------------------------------------------------------------------
*/

function numericId(value) {
  const id = Number(value);

  return Number.isInteger(id) && id > 0
    ? id
    : null;
}


/*
|--------------------------------------------------------------------------
| Administrator Authentication
|--------------------------------------------------------------------------
*/

export async function getAdmin(pool, request) {

  const adminId = numericId(
    request.get("x-admin-id")
  );

  if (!adminId) {

    const error = new Error(
      "Administrator authentication required."
    );

    error.statusCode = 401;

    throw error;
  }

  const { rows } = await pool.query(
    "SELECT * FROM admins WHERE admin_id = $1",
    [adminId]
  );

  requireAdmin(
    rows[0] && {
      ...rows[0],
      id: rows[0].admin_id,
      isAdmin: true,
    }
  );

  return rows[0];
}


/*
|--------------------------------------------------------------------------
| Error Handler
|--------------------------------------------------------------------------
*/

function sendError(response, error) {

  return response
    .status(error.statusCode || 500)
    .json({
      success: false,
      message:
        error.message ||
        "Request failed.",
    });
}


/*
|--------------------------------------------------------------------------
| Student ID Photo Upload
|--------------------------------------------------------------------------
*/

const moduleDirectory =
  path.dirname(
    fileURLToPath(import.meta.url)
  );

const privateUploadDirectory =
  path.resolve(
    moduleDirectory,
    "../private-uploads"
  );

fs.mkdirSync(
  privateUploadDirectory,
  {
    recursive: true,
  }
);


const upload = multer({

  dest: privateUploadDirectory,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (
    _request,
    file,
    callback
  ) => {

    if (
      !file.mimetype.startsWith("image/")
    ) {

      return callback(
        new Error(
          "Student ID photo must be an image file."
        )
      );
    }

    callback(null, true);
  },

});


/*
|--------------------------------------------------------------------------
| Marketplace Routes
|--------------------------------------------------------------------------
*/

export function registerMarketplaceRoutes(
  app,
  pool
) {


  /*
  |--------------------------------------------------------------------------
  | ADMIN DASHBOARD STATISTICS
  |--------------------------------------------------------------------------
  */

  app.get(
    "/api/admin/dashboard/stats",
    async (request, response) => {

      try {

        await getAdmin(
          pool,
          request
        );

        const { rows } =
          await pool.query(`

            SELECT

              COUNT(*)::int
                AS "totalStudents",

              COUNT(*)
                FILTER (
                  WHERE verification_status = 'PENDING'
                )::int
                AS "pendingVerification",

              COUNT(*)
                FILTER (
                  WHERE verification_status = 'VERIFIED'
                )::int
                AS "verifiedStudents",

              COUNT(*)
                FILTER (
                  WHERE verification_status = 'SUSPENDED'
                )::int
                AS "suspendedAccounts",

              COUNT(*)
                FILTER (
                  WHERE verification_status = 'REJECTED'
                )::int
                AS "rejectedStudents",

              COUNT(*)
                FILTER (
                  WHERE verification_status = 'RESUBMISSION_REQUIRED'
                )::int
                AS "resubmissionRequired",

              (
                SELECT COUNT(*)::int
                FROM listings
                WHERE listing_status = 'PENDING_REVIEW'
              )
                AS "pendingListings"

            FROM students

          `);

        return response.json({
          success: true,
          stats: rows[0],
        });

      } catch (error) {

        return sendError(
          response,
          error
        );
      }
    }
  );


  /*
  |--------------------------------------------------------------------------
  | LOGIN
  |--------------------------------------------------------------------------
  |
  | No account-type dropdown.
  |
  | The system checks:
  |
  | 1. admins table
  | 2. students table
  |
  */

app.post(
  "/api/auth/login",
  async (request, response) => {

    try {

      const {
        email,
        password,
      } = request.body;

      if (!email || !password) {

        const error = new Error(
          "Email and password are required."
        );

        error.statusCode = 400;

        throw error;
      }

      const normalizedEmail =
        String(email).trim().toLowerCase();

      const [
        { rows: adminRows },
        { rows: studentRows },
      ] = await Promise.all([

        pool.query(
          "SELECT * FROM admins WHERE LOWER(TRIM(email)) = $1",
          [normalizedEmail]
        ),

        pool.query(
          "SELECT * FROM students WHERE LOWER(TRIM(institutional_email)) = $1",
          [normalizedEmail]
        ),

      ]);

      const admin = adminRows[0];
      const student = studentRows[0];

      const adminMatches =
        Boolean(
          admin?.password_hash &&
          await bcrypt.compare(
            password,
            admin.password_hash
          )
        );

      const studentMatches =
        Boolean(
          student?.password_hash &&
          await bcrypt.compare(
            password,
            student.password_hash
          )
        );

      // =========================
      // ADMIN LOGIN
      // =========================

      if (adminMatches) {

        return response.json({

          success: true,

          account: {

            accountType: "admin",

            adminId:
              admin.admin_id,

            email:
              admin.email,

            name:
              admin.name,

          },

        });
      }

      // =========================
      // STUDENT LOGIN
      // =========================

      if (studentMatches) {

        return response.json({

          success: true,

          account: {

            accountType: "student",

            studentId:
              student.student_id,

            email:
              student.institutional_email,

            name:
              student.full_name,

            verificationStatus:
              student.verification_status,

          },

        });
      }

      if (
        (student && !student.password_hash) ||
        (admin && !admin.password_hash && !student)
      ) {

        const error = new Error(
          "This account has no password saved. Please register again with a new password or ask an administrator to reset it."
        );

        error.statusCode = 401;

        throw error;
      }

      const error = new Error(
        "Invalid email or password."
      );

      error.statusCode = 401;

      throw error;

    } catch (error) {

      return sendError(
        response,
        error
      );
    }
  }
);


  /*
  |--------------------------------------------------------------------------
  | STUDENT REGISTRATION
  |--------------------------------------------------------------------------
  |
  | Student ID photo:
  |
  | upload.single("student_id")
  |
  */

  app.post(
    "/api/students/register",
    upload.single("student_id"),
    async (request, response) => {

      try {

        const student =
          { ...request.body };

        if (student.institutional_email) {
          student.institutional_email =
            String(student.institutional_email)
              .trim()
              .toLowerCase();
        }


        /*
        |--------------------------------------------------------------------------
        | Validate student information
        |--------------------------------------------------------------------------
        */

        validateStudentForApproval(
          student
        );


        /*
        |--------------------------------------------------------------------------
        | Require Student ID photo
        |--------------------------------------------------------------------------
        */

        if (!request.file) {

          const error = new Error(
            "Student ID photo is required."
          );

          error.statusCode = 400;

          throw error;
        }


        /*
        |--------------------------------------------------------------------------
        | Password validation
        |--------------------------------------------------------------------------
        */

        if (
          !student.password ||
          student.password.length < 8
        ) {

          const error = new Error(
            "Password must be at least 8 characters."
          );

          error.statusCode = 400;

          throw error;
        }


        /*
        |--------------------------------------------------------------------------
        | Hash password
        |--------------------------------------------------------------------------
        */

        const passwordHash =
          await bcrypt.hash(
            student.password,
            12
          );


        /*
        |--------------------------------------------------------------------------
        | Insert student
        |--------------------------------------------------------------------------
        |
        | Existing database structure is used.
        |
        | Student ID photo is saved in:
        |
        | document_path
        |
        */

        const result =
          await pool.query(

            `INSERT INTO students
              (
                full_name,
                institutional_email,
                student_number,
                school,
                college,
                program,
                password_hash,
                year_level,
                contact,
                document_path
              )

              VALUES
              (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10
              )

              RETURNING student_id`,

            [

              student.full_name,

              student.institutional_email,

              student.student_number,

              student.school,

              student.college,

              student.program,

              passwordHash,

              student.year_level ||
                null,

              student.contact ||
                null,

              request.file?.path ||
                student.document_path ||
                null,

            ]
          );


        return response
          .status(201)
          .json({

            success: true,

            student: {

              ...student,

              student_id:
                result.rows[0]
                  .student_id,

              verification_status:
                VERIFICATION_STATUS.PENDING,

            },

          });


      } catch (error) {

        return sendError(
          response,
          error
        );
      }
    }
  );


  /*
  |--------------------------------------------------------------------------
  | STUDENT VERIFICATION STATUS
  |--------------------------------------------------------------------------
  */

  app.get(
    "/api/students/:studentId/verification-status",
    async (request, response) => {

      try {

        const studentId =
          numericId(
            request.params.studentId
          );


        if (!studentId) {

          return response
            .status(400)
            .json({

              success: false,

              message:
                "Invalid student ID.",

            });
        }


        const { rows } =
          await pool.query(

            `SELECT
              student_id,
              verification_status,
              verification_reason,
              verified_at

             FROM students

             WHERE student_id = $1`,

            [studentId]

          );


        if (!rows[0]) {

          return response
            .status(404)
            .json({

              success: false,

              message:
                "Student not found.",

            });
        }


        return response.json({

          success: true,

          student:
            rows[0],

        });


      } catch (error) {

        return sendError(
          response,
          error
        );
      }
    }
  );


  /*
  |--------------------------------------------------------------------------
  | ADMIN - ALL STUDENTS
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  |
  | This returns ALL matching records.
  |
  | There is NO rows[0].
  | There is NO LIMIT 1.
  |
  */

  app.get(
    "/api/admin/students",
    async (request, response) => {

      try {

        await getAdmin(
          pool,
          request
        );


        const status =
          request.query.status;


        if (
          status &&
          !Object.values(
            VERIFICATION_STATUS
          ).includes(status)
        ) {

          const error = new Error(
            "Invalid status filter."
          );

          error.statusCode = 400;

          throw error;
        }


        const { rows } =
          await pool.query(

            `SELECT

              student_id,
              full_name,
              institutional_email,
              student_number,
              school,
              college,
              program,
              year_level,
              contact,
              verification_status,
              verification_reason,
              verified_at,
              created_at

             FROM students

             WHERE
              (
                $1::varchar IS NULL
                OR verification_status = $1::varchar
              )

             ORDER BY
              (
                verification_status = 'PENDING'
              ) DESC,

              created_at DESC,

              student_id DESC`,

            [
              status || null
            ]

          );


        return response.json({

          success: true,

          students: rows,

        });


      } catch (error) {

        return sendError(
          response,
          error
        );
      }
    }
  );


  /*
  |--------------------------------------------------------------------------
  | ADMIN - VIEW A STUDENT'S PRIVATE ID PHOTO
  |--------------------------------------------------------------------------
  |
  | The image is stored outside the public web directory. Only an admin
  | whose ID is present in the admins table can request it.
  */

  app.get(
    "/api/admin/students/:studentId/document",
    async (request, response) => {
      try {
        await getAdmin(pool, request);

        const studentId = numericId(request.params.studentId);
        if (!studentId) {
          return response.status(400).json({ message: "Invalid student ID." });
        }

        const { rows } = await pool.query(
          "SELECT document_path FROM students WHERE student_id = $1",
          [studentId]
        );

        if (!rows[0]?.document_path) {
          return response.status(404).json({ message: "No student ID photo was uploaded for this account." });
        }

        // Resolve the stored path and ensure it cannot point outside private-uploads.
        const filePath = path.resolve(rows[0].document_path);
        const relativePath = path.relative(privateUploadDirectory, filePath);
        if (
          !relativePath ||
          relativePath.startsWith(`..${path.sep}`) ||
          relativePath === ".." ||
          path.isAbsolute(relativePath)
        ) {
          return response.status(403).json({ message: "The stored document path is invalid." });
        }

        try {
          await fs.promises.access(filePath, fs.constants.R_OK);
        } catch {
          return response.status(404).json({ message: "The uploaded student ID photo could not be found on the server." });
        }

        // Multer stores files without extensions, so determine the image MIME type
        // from its signature instead of assuming every upload is a JPEG.
        const fileHandle = await fs.promises.open(filePath, "r");
        const signature = Buffer.alloc(12);
        try {
          await fileHandle.read(signature, 0, signature.length, 0);
        } finally {
          await fileHandle.close();
        }

        let contentType = "application/octet-stream";
        if (signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff) contentType = "image/jpeg";
        else if (signature.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) contentType = "image/png";
        else if (signature.toString("ascii", 0, 3) === "GIF") contentType = "image/gif";
        else if (signature.toString("ascii", 0, 4) === "RIFF" && signature.toString("ascii", 8, 12) === "WEBP") contentType = "image/webp";

        if (!contentType.startsWith("image/")) {
          return response.status(415).json({ message: "The uploaded file is not a supported image format." });
        }

        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Content-Type", contentType);
        return response.sendFile(filePath, (error) => {
          if (error && !response.headersSent) {
            return response.status(error.statusCode || 500).json({ message: "Unable to display the student ID photo." });
          }
        });
      } catch (error) {
        return sendError(response, error);
      }
    }
  );


  /*
  |--------------------------------------------------------------------------
  | STUDENT VERIFICATION TRANSITIONS
  |--------------------------------------------------------------------------
  */

  const STUDENT_TRANSITIONS = {

    [VERIFICATION_STATUS.VERIFIED]:
      [
        VERIFICATION_STATUS.PENDING,
      ],

    [VERIFICATION_STATUS.REJECTED]:
      [
        VERIFICATION_STATUS.PENDING,
      ],

    [VERIFICATION_STATUS.SUSPENDED]:
      [
        VERIFICATION_STATUS.VERIFIED,
      ],

  };


  /*
  |--------------------------------------------------------------------------
  | ADMIN STUDENT DECISION
  |--------------------------------------------------------------------------
  |
  | Each request updates ONLY the selected
  | student.
  |
  */

  app.post(
    [
      "/api/admin/students/:studentId/decision",

      "/api/admin/students/:studentId/approve",
    ],

    async (request, response) => {

      let connection;


      try {

        const admin =
          await getAdmin(
            pool,
            request
          );


        const studentId =
          numericId(
            request.params.studentId
          );


        const body =
          request.body || {};


        const nextStatus =
          body.status ||
          VERIFICATION_STATUS.VERIFIED;


        const reason =
          body.reason ||
          null;


        if (
          !studentId ||
          !STUDENT_TRANSITIONS[
            nextStatus
          ]
        ) {

          const error = new Error(
            "Invalid student decision."
          );

          error.statusCode = 400;

          throw error;
        }


        /*
        |--------------------------------------------------------------------------
        | Transaction
        |--------------------------------------------------------------------------
        */

        connection =
          await pool.connect();


        await connection.query(
          "BEGIN"
        );


        /*
        |--------------------------------------------------------------------------
        | Lock only selected student
        |--------------------------------------------------------------------------
        */

        const { rows } =
          await connection.query(

            `
            SELECT *
            FROM students
            WHERE student_id = $1::bigint
            FOR UPDATE
            `,

            [studentId]

          );


        const student =
          rows[0];


        if (!student) {

          const error = new Error(
            "Student not found."
          );

          error.statusCode = 404;

          throw error;
        }


        /*
        |--------------------------------------------------------------------------
        | Validate status transition
        |--------------------------------------------------------------------------
        */

        if (
          !STUDENT_TRANSITIONS[
            nextStatus
          ].includes(
            student.verification_status
          )
        ) {

          const error = new Error(

            `Cannot change a ${student.verification_status} student to ${nextStatus}.`

          );

          error.statusCode = 409;

          throw error;
        }


        /*
        |--------------------------------------------------------------------------
        | Verify student
        |--------------------------------------------------------------------------
        */

        if (
          nextStatus ===
          VERIFICATION_STATUS.VERIFIED
        ) {

          approveStudent(
            student,
            {
              ...admin,
              isAdmin: true,
            }
          );
        }


        const isVerified =
          nextStatus ===
          VERIFICATION_STATUS.VERIFIED;


        /*
        |--------------------------------------------------------------------------
        | UPDATE
        |--------------------------------------------------------------------------
        |
        | Explicit PostgreSQL types prevent:
        |
        | inconsistent types deduced for parameter $1
        |
        */

        await connection.query(

          `
          UPDATE students

          SET

            verification_status =
              $1::varchar,

            verification_reason =
              $2::text,

            verified_by =
              $3::bigint,

            verified_at =
              $4::timestamp,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            student_id =
              $5::bigint
          `,

          [

            nextStatus,

            reason,

            isVerified
              ? admin.admin_id
              : null,

            isVerified
              ? new Date()
              : null,

            studentId,

          ]

        );


        /*
        |--------------------------------------------------------------------------
        | Audit log
        |--------------------------------------------------------------------------
        */

        await connection.query(

          `
          INSERT INTO verification_audit_logs
          (
            student_id,
            admin_id,
            action,
            previous_status,
            new_status,
            reason
          )

          VALUES
          (
            $1::bigint,
            $2::bigint,
            $3::varchar,
            $4::varchar,
            $5::varchar,
            $6::text
          )
          `,

          [

            studentId,

            admin.admin_id,

            "STUDENT_STATUS_CHANGED",

            student.verification_status,

            nextStatus,

            reason,

          ]

        );


        await connection.query(
          "COMMIT"
        );


        return response.json({

          success: true,

          studentId,

          status:
            nextStatus,

        });


      } catch (error) {

        if (connection) {

          await connection
            .query("ROLLBACK")
            .catch(() => {});

        }

        return sendError(
          response,
          error
        );


      } finally {

        connection?.release();

      }

    }
  );


  /*
  |--------------------------------------------------------------------------
  | CREATE LISTING
  |--------------------------------------------------------------------------
  */

  app.post(
    "/api/listings",
    async (request, response) => {

      try {

        const studentId =
          numericId(
            request.get(
              "x-student-id"
            )
          );


        if (!studentId) {

          const error = new Error(
            "Student authentication required."
          );

          error.statusCode = 401;

          throw error;
        }


        const { rows } =
          await pool.query(

            "SELECT * FROM students WHERE student_id = $1",

            [studentId]

          );


        const listing =
          createListing(
            rows[0],
            request.body
          );


        const result =
          await pool.query(

            `INSERT INTO listings
              (
                seller_id,
                item_name,
                category,
                description,
                condition_label,
                price_centavos,
                photos
              )

             VALUES
              (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7
              )

             RETURNING listing_id`,

            [

              listing.seller_id,

              listing.item_name,

              listing.category,

              listing.description ||
                null,

              listing.condition_label,

              listing.price_centavos,

              JSON.stringify(
                listing.photos || []
              ),

            ]

          );


        return response
          .status(201)
          .json({

            success: true,

            listingId:
              result.rows[0]
                .listing_id,

            listingStatus:
              LISTING_STATUS.PENDING_REVIEW,

          });


      } catch (error) {

        return sendError(
          response,
          error
        );
      }
    }
  );


  /*
  |--------------------------------------------------------------------------
  | GET APPROVED LISTINGS
  |--------------------------------------------------------------------------
  */

  app.get(
    "/api/listings",
    async (_request, response) => {

      try {

        const { rows } =
          await pool.query(

            `
            SELECT *
            FROM listings
            WHERE listing_status = $1
            ORDER BY created_at DESC
            `,

            [
              LISTING_STATUS.APPROVED
            ]

          );


        return response.json({

          success: true,

          listings:
            rows.filter(
              canDisplayListing
            ),

        });


      } catch (error) {

        return sendError(
          response,
          error
        );
      }
    }
  );


  /*
  |--------------------------------------------------------------------------
  | ADMIN LISTING DECISION
  |--------------------------------------------------------------------------
  */

  app.post(
    "/api/admin/listings/:listingId/decision",

    async (request, response) => {

      const connection =
        await pool.connect();


      try {

        const admin =
          await getAdmin(
            pool,
            request
          );


        const listingId =
          numericId(
            request.params.listingId
          );


        const nextStatus =
          request.body.status;


        if (
          !listingId ||
          ![
            LISTING_STATUS.APPROVED,
            LISTING_STATUS.REJECTED,
            LISTING_STATUS.REMOVED,
          ].includes(nextStatus)
        ) {

          const error = new Error(
            "Invalid listing decision."
          );

          error.statusCode = 400;

          throw error;
        }


        const { rows } =
          await connection.query(

            `
            SELECT *
            FROM listings
            WHERE listing_id = $1
            FOR UPDATE
            `,

            [listingId]

          );


        const listing =
          rows[0];


        if (!listing) {

          const error = new Error(
            "Listing not found."
          );

          error.statusCode = 404;

          throw error;
        }


        await connection.query(
          "BEGIN"
        );


        await connection.query(

          `
          UPDATE listings

          SET listing_status = $1

          WHERE listing_id = $2
          `,

          [
            nextStatus,
            listingId,
          ]

        );


        await connection.query(

          `
          INSERT INTO verification_audit_logs
          (
            listing_id,
            admin_id,
            action,
            previous_status,
            new_status,
            reason
          )

          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
          `,

          [

            listingId,

            admin.admin_id,

            "LISTING_STATUS_CHANGED",

            listing.listing_status,

            nextStatus,

            request.body.reason ||
              null,

          ]

        );


        await connection.query(
          "COMMIT"
        );


        return response.json({

          success: true,

          listingId,

          status:
            nextStatus,

        });


      } catch (error) {

        await connection
          .query("ROLLBACK")
          .catch(() => {});

        return sendError(
          response,
          error
        );


      } finally {

        connection.release();

      }

    }
  );

}