import { requireVerifiedStudent } from "./verification-service.js";

export const LISTING_STATUS = Object.freeze({
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  SOLD: "SOLD",
  REMOVED: "REMOVED",
});

export function createListing(student, listing) {
  requireVerifiedStudent(student);
  if (!listing?.item_name || !listing?.category || !Number.isFinite(Number(listing.price_centavos))) {
    const error = new Error("Listing information is incomplete.");
    error.statusCode = 400;
    throw error;
  }
  return {
    ...listing,
    seller_id: student.student_id,
    listing_status: LISTING_STATUS.PENDING_REVIEW,
  };
}

export function canDisplayListing(listing) {
  return listing?.listing_status === LISTING_STATUS.APPROVED;
}

export function approveListing(listing, admin) {
  if (!admin?.isAdmin) {
    const error = new Error("Only administrators can approve listings.");
    error.statusCode = 403;
    throw error;
  }
  return { ...listing, listing_status: LISTING_STATUS.APPROVED };
}
