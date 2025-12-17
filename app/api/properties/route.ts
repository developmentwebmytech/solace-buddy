import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import VendorProperty from "@/lib/models/vendorproper"

export async function GET(request: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q") || ""
    const type = searchParams.get("type")
    const gender = searchParams.get("gender")
    const city = searchParams.get("city")

    const minPrice = Number.parseInt(searchParams.get("minPrice") || "0", 10)
    const maxPrice = Number.parseInt(searchParams.get("maxPrice") || "50000", 10)
    const areas = searchParams.get("areas") // comma-separated areas
    const sharing = searchParams.get("sharing") // comma-separated sharing values
    const ac = searchParams.get("ac") // comma-separated ac types

    const page = Number.parseInt(searchParams.get("page") || "1", 10)
    const pageSize = Number.parseInt(searchParams.get("pageSize") || "24", 10)

    // ✅ Filter to show only properties that have status = "public"
    const filter: any = {
      isActive: true,
      $and: [{ status: { $exists: true } }, { status: "public" }],
    }

    const priceFilter: any = {}
    if (minPrice > 0 || maxPrice < 50000) {
      priceFilter.$or = [
        // Filter by rooms' rent prices
        { "rooms.rent": { $gte: minPrice, $lte: maxPrice } },
        // Also check rentRange if it exists
        { "rentRange.min": { $lte: maxPrice }, "rentRange.max": { $gte: minPrice } },
      ]
    }

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { pgNickName: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
        { area: { $regex: q, $options: "i" } },
        { city: { $regex: q, $options: "i" } },
        { state: { $regex: q, $options: "i" } },
        { nearbyLandmark: { $regex: q, $options: "i" } },
        { ownerName: { $regex: q, $options: "i" } },
      ]
    }

    if (type && type !== "all") {
      if (type === "pg") {
        filter.type = "PG"
      } else if (type === "hostel") {
        filter.type = "Hostel"
      } else if (type === "both") {
        filter.type = "Both"
      }
    }

    if (gender && gender !== "all") {
      filter.gender = gender
    }

    if (city && city !== "all") {
      filter.city = new RegExp(`^${city}$`, "i")
    }

    if (areas) {
      const areaList = areas
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
      if (areaList.length > 0) {
        filter.$or = filter.$or || []
        const areaQueries = areaList.map((a) => ({
          $or: [
            { city: new RegExp(`^${a}$`, "i") },
            { address: { $regex: a, $options: "i" } },
            { area: { $regex: a, $options: "i" } },
            { nearbyLandmark: { $regex: a, $options: "i" } },
          ],
        }))
        filter.$and = [...(filter.$and || []), { $or: areaQueries }]
      }
    }

    const roomFilter: any = {}
    if (sharing) {
      const sharingList = sharing
        .split(",")
        .map((s) => Number(s))
        .filter((n) => !isNaN(n))
      if (sharingList.length > 0) {
        roomFilter.noOfSharing = { $in: sharingList }
      }
    }
    if (ac) {
      const acList = ac.split(",").map((a) => a.trim().toLowerCase())
      if (acList.length > 0) {
        roomFilter.acType = { $in: acList.map((a) => (a === "ac" ? "AC" : "Non AC")) }
      }
    }

    // Apply room filters if any exist
    if (Object.keys(roomFilter).length > 0) {
      filter.rooms = { $elemMatch: roomFilter }
    }

    // Merge price filter with main filter
    if (Object.keys(priceFilter).length > 0) {
      filter.$and = [...(filter.$and || []), priceFilter]
    }

    const [items, total] = await Promise.all([
      VendorProperty.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      VendorProperty.countDocuments(filter),
    ])

    return NextResponse.json({
      success: true,
      data: items.map((p: any) => ({
        _id: String(p._id),
        slug: p.slug || null,
        propertyId: p.propertyId,
        name: p.name,
        pgNickName: p.pgNickName,
        type: p.type || "PG",
        address: p.address,
        area: p.area,
        city: p.city,
        state: p.state,
        gender: p.gender,
        rentRange: p.rentRange || { min: 0, max: 0 },
        totalBeds: p.totalBeds || 0,
        availableBeds: p.availableBeds || 0,
        amenities: Array.isArray(p.amenities) ? p.amenities : [],
        images: p.mainImage
          ? [p.mainImage, ...(Array.isArray(p.commonPhotos) ? p.commonPhotos : [])]
          : Array.isArray(p.images) && p.images.length
            ? p.images
            : ["/diverse-property-showcase.png"],
        nearbyLandmark: p.nearbyLandmark || "",
      })),
      total,
      page,
      pageSize,
    })
  } catch (err: any) {
    console.error("Properties API Error:", err)
    return NextResponse.json({ success: false, message: err.message || "Failed to load properties" }, { status: 500 })
  }
}
