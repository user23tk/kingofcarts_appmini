import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-singleton"
import { requireDebugAuth } from "@/lib/security/debug-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    const auth = await requireDebugAuth(request)
    if (!auth.authorized) return auth.response

    const searchParams = request.nextUrl.searchParams
    const giveawayId = searchParams.get("giveaway_id")

    if (!giveawayId) {
        return NextResponse.json({ error: "Giveaway ID missing" }, { status: 400 })
    }

    try {
        const supabase = createAdminClient()

        // Fetch entries with user details
        const { data: entries, error } = await supabase
            .from("giveaway_entries")
            .select(`
        ticket_number,
        created_at,
        users (
          id,
          username,
          first_name,
          last_name,
          telegram_id
        )
      `)
            .eq("giveaway_id", giveawayId)
            .order("ticket_number", { ascending: true })

        if (error) {
            throw error
        }

        // Convert to CSV
        const headers = ["Ticket Number", "Username", "First Name", "Last Name", "Telegram ID", "User ID", "Entry Date"]
        const rows = entries.map((entry: any) => [
            entry.ticket_number,
            entry.users?.username || "",
            entry.users?.first_name || "",
            entry.users?.last_name || "",
            entry.users?.telegram_id || "",
            entry.users?.id || "",
            new Date(entry.created_at).toISOString(),
        ])

        const csvContent = [headers.join(","), ...rows.map((row) => row.map((field) => `"${field}"`).join(","))].join("\n")

        return new NextResponse(csvContent, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="giveaway_entries_${giveawayId}.csv"`,
            },
        })
    } catch (error) {
        console.error("Error exporting giveaway:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
