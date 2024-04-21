import * as dotenv from "dotenv"
import * as fs from "fs"
dotenv.config({ path: "./database.env" })

import { Client } from "pg";
import { describe, expect, test } from "./TestFunctionalities";

export const client = new Client()

client.connect()

const prepData: { schema: string, table: string, values: any[][] }[] = [{ schema: "public", table: "mytable", values: [[1, "someTestValue"], [1411, "someOtherValue"]] }, { schema: "schemaaa", table: "other_table", values: [[69, "noice"]] }];

const simpleReq = async (preparation?: { schema: string, table: string, values: any[][] }[]) => {
	let query = "SELECT * FROM pg_proc WHERE proname = 'add';"
	let values: any[] = [];
	let res = await client.query(query, values)
	// console.log(res.rows[0])
	let src: string = res.rows[0].prosrc;

	let nextSearchStartIndex = 0
	while (true) {
		let insertIndex = src.indexOf("INSERT INTO", nextSearchStartIndex)
		if (insertIndex < 0) break
		insertIndex += ("INSERT INTO ".length)

		nextSearchStartIndex = src.indexOf(";", insertIndex) + 1;


		const foundName: string = src.substring(insertIndex).split(" ").filter((item) => item != "")[0]
		const tableAndSchemaName: string = foundName.split("(")[0];
		// console.log("table and schema name:", tableAndSchemaName)

		const separatedTableAndSchema: string[] = tableAndSchemaName.split(".")
		const tableName: string = separatedTableAndSchema[separatedTableAndSchema.length - 1]

		let schemaName = "public"
		if (separatedTableAndSchema.length === 2) {
			schemaName = separatedTableAndSchema[0]
		}
		console.log("tableName without schema:", tableName)
		console.log("schema name:", schemaName)

		console.log("================")
		let query = "SELECT * from information_schema.columns WHERE table_schema = ($1) AND table_name = ($2);"
		let values: any[] = [schemaName, tableName];
		let res = await client.query(query, values)
		console.log(res.rows.length)
		if (res.rows.length) {
			if (!foundName.includes("(")) {
				src = src.replace(` ${foundName} `, ` ${schemaName}.test_${tableName} `);
			} else {
				src = src.replace(` ${foundName} `, ` ${schemaName}.test_${tableName}(${foundName.split("(")[1]} `);
			}
			console.log("table truely is one");
			let query = `CREATE TABLE ${schemaName}.test_${tableName} as (select * from ${schemaName}.${tableName}) with no data;`
			let values: any[] = [];
			let res = await client.query(query, values);
			console.log("res of table cloning", res);
		}
		console.log("================");

	}
	console.log("--------------------")
	//-----------
	//preparation
	if (preparation) {
		for (let i = 0; i < preparation.length; i++) {
			let query = `INSERT INTO ${preparation[i].schema}.test_${preparation[i].table} VALUES (`
			for (let j = 0; j < preparation[i].values[0].length; j++) {
				if (j === 0) {
					query += `($${j + 1}) `;
				} else {
					query += `, ($${j + 1}) `
				}
			}
			query += ");";

			for (const valuePair of preparation[i].values) {
				const values = valuePair
				console.log("values for preparation:", values)
				console.log("query:", query);
				const res = await client.query(query, values);
			}
		}
	}

	//-----------

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
		};
	}

	const functionName = "add";

	const prefix = `CREATE OR REPLACE FUNCTION test_${functionName} (${argsString})\n RETURNS ${returnType}\n LANGUAGE plpgsql\nAS $$\n`;
	const postfix = "\n$$;"

	const result = prefix + src + postfix

	fs.writeFileSync(__dirname + "/blubby.txte", result)
}

// simpleReq(prepData)
