import { client } from "./DbConnector"

export function expect(tableWithSchema: string) {
	return {
		toHave: async (row: Record<string, any>) => {
			// console.log("toHave:", "key:", Object.entries(row))
			let query = `SELECT * FROM ${tableWithSchema} WHERE `
			for (let i = 0; i < Object.entries(row).length; i++) {
				if (i === 0) {
					query += `${Object.entries(row)[i][0]} = ($${i + 1}) `
				} else {
					query += `AND ${Object.entries(row)[i][0]} = ($${i + 1})`
				}
			}
			// console.log(query)
			const values = Object.values(row)

			return new Promise(async (resolve, reject) => {
				let res
				try {
					res = await client.query(query, values);
				} catch (e) {
					console.log(e)
					reject(`some error while fetching request from the database: ${e}`,)
				}
				if (res?.rows.length === 1) {
					console.log(`\ttoHave for ${tableWithSchema} with ${values} successful`); resolve("in table")
				} else {
					console.log(`\ttoHave for ${tableWithSchema} with ${values} not successful`)
					reject(`some error for the table ${tableWithSchema}`)
				}
			})

		},
		toBeSizeOf: () => { console.log("toBeSizeOf:") }
	}
}


export async function test(name: string, cb: () => any) {
	console.log("Testing", name)
	try {
		await new Promise(async (resolve, reject) => {
			try {
				// await Promise.all(cb())
				await cb()
				// return true
				resolve(true)
			} catch (e) {
				// return false
				reject(e)
			}
		})
	} catch (e) { console.log("some error in testing:", e); return }
	console.log("all tests successful")
	return
}



export async function describe(name: string, cb: () => any) {
	console.log("Testing", name)
	try {
		await new Promise(async (resolve, reject) => {
			try {
				// await Promise.all(cb())
				await cb()
				// return true
				resolve(true)
			} catch (e) {
				// return false
				reject(e)
			}
		})
	} catch (e) { return }
	return
}

// describe("multiple tests", async () => {
// 	await test("someTesting", async () => {
// 		await expect("schemaaa.test_other_table").toHave({ id: 69, some_text: "noice" })
// 		await expect("schemaaa.test_other_table").toHave({ id: 69, some_text: "noice" })
// 		await expect("schemaaa.test_other_table").toHave({ id: 3, some_text: "noice" })
// 	})
//
// 	await test("someOtherTesting", async () => {
// 		await expect("schemaaa.test_other_table").toHave({ id: 69, some_text: "noice" })
// 		await expect("schemaaa.test_other_table").toHave({ id: 69, some_text: "noice" })
// 		await expect("schemaaa.test_other_table").toHave({ id: 3, some_text: "noice" })
// 	})
//
// })
//
// test("testing without describe", async () => {
// 	await expect("schemaaa.test_other_table").toHave({ id: 69, some_text: "noice" })
// 	await expect("schemaaa.test_other_table").toHave({ id: 69, some_text: "noice" })
// 	await expect("schemaaa.test_other_table").toHave({ id: 3, some_text: "noice" })
// })
