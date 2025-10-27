import mysql from "mysql2/promise"

type DBConfig = {
  host: string
  port: number
  user: string
  password: string
  database?: string
}

let pool: mysql.Pool | null = null

function getConfig(): DBConfig {
  const host = process.env.DB_HOST ?? "127.0.0.1"
  const port = Number.parseInt(process.env.DB_PORT ?? "3307", 10)
  const user = process.env.DB_USER ?? "drone_user"
  const password = process.env.DB_PASSWORD ?? "dronepwd"
  const database = process.env.DB_NAME ?? "drone_sop"

  return {
    host,
    port: Number.isNaN(port) ? 3307 : port,
    user,
    password,
    database,
  }
}

export function getPool() {
  if (!pool) {
    const config = getConfig()
    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      timezone: "Z",
    })
  }

  return pool
}

export async function runQuery<T extends mysql.RowDataPacket[] | mysql.OkPacket>(
  sql: string,
  params: unknown[] = []
) {
  const currentPool = getPool()
  const [rows] = await currentPool.query<T>(sql, params)
  return rows
}
