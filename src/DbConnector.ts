import * as dotenv from "dotenv"
import * as fs from "fs"
dotenv.config({ path: "./database.env" })

import { Client } from "pg";

const client = new Client()

client.connect()

const simpleReq = async () => {
	let query = "SELECT * FROM pg_proc WHERE proname = 'add';"
	let values: any[] = []
	let res = await client.query(query, values)
	console.log(res.rows[0])
	const src = res.rows[0].prosrc

	let returnType: number | string = res.rows[0].prorettype
	let inputTypes: number[] | string[] = res.rows[0].proargtypes.match(/\d+/g).map((inString: string) => { return parseInt(inString) })
	const inputArgs: string[] = res.rows[0].proargnames

	const typeSet = Array.from(new Set([returnType, ...inputTypes]))
	console.log("typeSet:", typeSet)

	const typeMap = new Map<number, string>()

	query = "SELECT typname, oid FROM pg_type where oid IN ($1);"
	res = await client.query(query, typeSet);
	for (let i = 0; i < res.rows.length; i++) {
		console.log(res.rows[i])
		typeMap.set(res.rows[i].oid, res.rows[i].typname)
	}

	console.log("typeMap:", typeMap)

	console.log("\nVor Umwandlung:\n")
	console.log("returntype:", returnType)
	console.log("inputTypes:", inputTypes)
	console.log("inputArgs:", inputArgs, "\n")

	returnType = typeMap.get(returnType as number)!
	inputTypes = inputTypes.map((item) => { return typeMap.get(item as number)! })

	console.log("\nNach Umwandlung:\n")
	console.log("returntype:", returnType)
	console.log("inputTypes:", inputTypes)
	console.log("inputArgs:", inputArgs, "\n")

	let argsString = ""
	for (let i = 0; i < inputArgs.length; i++) {
		if (i === 0) {
			argsString += `${inputArgs[i]} ${inputTypes[i]}`

		} else {
			argsString += `,${inputArgs[i]} ${inputTypes[i]}`
		}
	}

	const functionName = "add";

	const prefix = `CREATE OR REPLACE FUNCTION test_${functionName} (${argsString})\n RETURNS ${returnType}\n LANGUAGE plpgsql\nAS $$\n`;
	const postfix = "\n$$;"

	const result = prefix + src + postfix

	fs.writeFileSync(__dirname + "/blubby.txte", result)
}

simpleReq()