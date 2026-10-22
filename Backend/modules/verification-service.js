export const VERIFICATION_STATUS = Object.freeze({
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  SUSPENDED: "SUSPENDED",
  RESUBMISSION_REQUIRED: "RESUBMISSION_REQUIRED",
});

export function requireVerifiedStudent(student) {
  if (!student || student.verification_status !== VERIFICATION_STATUS.VERIFIED) {
    const error = new Error("Only verified students can perform this action.");
    error.statusCode = 403;
    throw error;
  }
  return student;
}

export function validateStudentForApproval(student) {
  const required = [
    "full_name",
    "institutional_email",
    "student_number",
    "school",
    "college",
    "program",
  ];
  const missing = required.filter((field) => !student?.[field]);
  if (missing.length) {
    const error = new Error(`Student information is incomplete: ${missing.join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }
  return student;
}

export function approveStudent(student, admin) {
  validateStudentForApproval(student);
  if (!admin?.isAdmin) {
    const error = new Error("Only administrators can approve students.");
    error.statusCode = 403;
    throw error;
  }
  return { ...student, verification_status: VERIFICATION_STATUS.VERIFIED };
}
