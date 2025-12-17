"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

type Area = { name: string; properties: number; image?: string }

function formatINR(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 })
}

function parseCsvParam(sp: URLSearchParams, key: string): string[] {
  const raw = sp.get(key)
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

const PRICE_RANGES = [
  { label: "₹0 - ₹7,000", min: 0, max: 7000 },
  { label: "₹7,001 - ₹12,000", min: 7001, max: 12000 },
  { label: "₹12,001 - ₹17,000", min: 12001, max: 17000 },
  { label: "₹17,001+", min: 17001, max: 50000 },
]

export function PropertySidebarFilters() {
  const router = useRouter()
  const sp = useSearchParams()

  const [selectedPriceRange, setSelectedPriceRange] = useState<number | null>(null)
  const [price, setPrice] = useState<[number, number]>([
    Number(sp.get("minPrice") || 0),
    Number(sp.get("maxPrice") || 50000),
  ])

  const [areas, setAreas] = useState<string[]>(parseCsvParam(sp, "areas"))
  const [sharing, setSharing] = useState<string[]>(parseCsvParam(sp, "sharing"))
  const [ac, setAc] = useState<string[]>(parseCsvParam(sp, "ac"))

  const [allAreas, setAllAreas] = useState<Area[]>([])
  const [loadingAreas, setLoadingAreas] = useState(false)

  // Keep in sync when search params change externally
  useEffect(() => {
    const minPrice = Number(sp.get("minPrice") || 0)
    const maxPrice = Number(sp.get("maxPrice") || 50000)
    setPrice([minPrice, maxPrice])

    const matchedRange = PRICE_RANGES.findIndex((r) => r.min === minPrice && r.max === maxPrice)
    setSelectedPriceRange(matchedRange >= 0 ? matchedRange : null)

    setAreas(parseCsvParam(sp, "areas"))
    setSharing(parseCsvParam(sp, "sharing"))
    setAc(parseCsvParam(sp, "ac"))
  }, [sp])

  // Fetch areas from API
  useEffect(() => {
    const fetchAreas = async () => {
      setLoadingAreas(true)
      try {
        const res = await fetch("/api/popular-areas")
        const data = await res.json()
        if (data?.success && Array.isArray(data?.data)) {
          setAllAreas(data.data as Area[])
        }
      } catch (e) {
        console.error("Failed to fetch areas", e)
      } finally {
        setLoadingAreas(false)
      }
    }
    fetchAreas()
  }, [])

  const buildUrl = (priceMin?: number, priceMax?: number) => {
    const params = new URLSearchParams()
    ;["q", "type", "gender", "city"].forEach((k) => {
      const v = sp.get(k)
      if (v && v !== "all" && v.trim()) params.set(k, v)
    })

    // Use provided price or current state
    const finalMin = priceMin !== undefined ? priceMin : price[0]
    const finalMax = priceMax !== undefined ? priceMax : price[1]

    if (finalMin > 0) params.set("minPrice", String(finalMin))
    if (finalMax < 50000) params.set("maxPrice", String(finalMax))

    if (areas.length) params.set("areas", areas.join(","))
    if (sharing.length) params.set("sharing", sharing.join(","))
    if (ac.length) params.set("ac", ac.join(","))

    return `/properties?${params.toString()}`
  }

  const apply = (priceMin?: number, priceMax?: number) => {
    router.push(buildUrl(priceMin, priceMax))
  }

  useEffect(() => {
    const t = setTimeout(() => {
      apply()
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price, areas, sharing, ac])

  const toggleInArray = (arr: string[], value: string, set: (v: string[]) => void) => {
    if (arr.includes(value)) set(arr.filter((v) => v !== value))
    else set([...arr, value])
  }

  const handlePriceRangeClick = (index: number) => {
    const range = PRICE_RANGES[index]
    if (selectedPriceRange === index) {
      // Deselect
      setSelectedPriceRange(null)
      setPrice([0, 50000])
      apply(0, 50000)
    } else {
      // Select
      setSelectedPriceRange(index)
      setPrice([range.min, range.max])
      apply(range.min, range.max)
    }
  }

  return (
    <aside aria-label="Filters" className="sticky top-4 mb-8">
      <Card className="p-4 border">
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔎</span>
            <h2 className="text-lg font-semibold">Filters</h2>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-medium mb-3">Price Range (Monthly Rent)</h3>
          <div className="space-y-2">
            {PRICE_RANGES.map((range, index) => (
              <button
                key={index}
                onClick={() => handlePriceRangeClick(index)}
                className={`w-full text-left px-3 py-2 rounded border-2 transition-colors ${
                  selectedPriceRange === index
                    ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-3 p-2 bg-gray-50 rounded">
            <span>Min: ₹{formatINR(price[0])}</span>
            <span>Max: ₹{formatINR(price[1])}</span>
          </div>
        </div>

        {/* Areas */}
        <div className="mt-6">
          <h3 className="text-sm font-medium mb-3">Areas</h3>
          <div className="space-y-3 max-h-64 overflow-auto pr-1">
            {loadingAreas && <div className="text-xs text-muted-foreground">Loading areas...</div>}
            {!loadingAreas &&
              (allAreas.length ? (
                allAreas.map((a) => {
                  const name = a.name
                  const checked = areas.includes(name)
                  return (
                    <label key={name} className="flex items-center gap-3 text-sm">
                      <Checkbox checked={checked} onCheckedChange={() => toggleInArray(areas, name, setAreas)} />
                      <span className="text-foreground">{name}</span>
                    </label>
                  )
                })
              ) : (
                <div className="text-xs text-muted-foreground">No areas</div>
              ))}
          </div>
        </div>

        {/* Sharing */}
        <div className="mt-6">
          <h3 className="text-sm font-medium mb-3">Sharing</h3>
          <div className="space-y-3">
            {["1", "2", "3", "4", "5", "6", "7", "8"].map((opt) => (
              <label key={opt} className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={sharing.includes(opt)}
                  onCheckedChange={() => toggleInArray(sharing, opt, setSharing)}
                />
                <span className="text-foreground">{opt}-Sharing</span>
              </label>
            ))}
          </div>
        </div>

        {/* AC Type */}
        <div className="mt-6">
          <h3 className="text-sm font-medium mb-3">AC Type</h3>
          <div className="space-y-3">
            {["ac", "non-ac"].map((opt) => (
              <label key={opt} className="flex items-center gap-3 text-sm capitalize">
                <Checkbox checked={ac.includes(opt)} onCheckedChange={() => toggleInArray(ac, opt, setAc)} />
                <span className="text-foreground">{opt === "ac" ? "AC" : "Non-AC"}</span>
              </label>
            ))}
          </div>
        </div>
      </Card>
    </aside>
  )
}
