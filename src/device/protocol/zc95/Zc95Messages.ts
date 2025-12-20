import {Zc95Serial} from "./Zc95Serial.js";

/* eslint-disable @typescript-eslint/naming-convention */
export interface MsgResponse {
    Type: string;
    MsgId: number;
    Result: "OK" | "ERROR"
    Error?: string;
    [key: string]: any;
}

export interface VersionMsgResponse extends MsgResponse {
    ZC95: string;
    WsMajor: number;
    WsMinor: number;
}

interface PatternDetail {
    Id: number;
    Name: string;
}

export interface PatternsMsgResponse extends MsgResponse {
    Patterns: PatternDetail[];
}

export interface PowerStatusMsgResponse extends MsgResponse {
    Chan1: number;
    Chan2: number;
    Chan3: number;
    Chan4: number;
}

interface ChannelPowerStatus {
    Channel: number;
    OutputPower: number;
    MaxOutputPower: number;
    PowerLimit: number;
}

export interface PowerStatusMsgResponse extends MsgResponse {
    Channels: ChannelPowerStatus[]
}

export interface MenuItem {
    Id: number;
    Title: string;
    Group: number;
    Type: 'MIN_MAX' | 'MULTI_CHOICE';
    Default: number;
}

export interface MinMaxMenuItem extends MenuItem {
    Min: number;
    Max: number;
    IncrementStep: number;
    UoM: string;
}

export interface MultiChoiceMenuItem extends MenuItem {
    Choices: { Id: number; Name: string }[];
}

export interface PatternDetailsMsgResponse extends MsgResponse {
    Name: string;
    Id: number;
    ButtonA: string;
    MenuItems: (MinMaxMenuItem|MultiChoiceMenuItem)[]
}

export class Zc95Messages {
    private connection: Zc95Serial;

    private msgId: number = 1;

    public constructor(connection: Zc95Serial) {
        this.connection = connection;
    }

    private send(message: any): void {
        const msgToSend = JSON.stringify(message);
        this.connection.send(msgToSend);
    }

    private async getResponse(expectedMsgId: number, expectedType: string): Promise<any> {
        const resultJson = await this.connection.recv(expectedMsgId);
        if (!resultJson) {
            throw new Error(`Didn't get any message, expected ${expectedType} (msgId = ${expectedMsgId})`);
        }

        const result = JSON.parse(resultJson) as MsgResponse;
        if (result.Type !== expectedType) {
            throw new Error(`Didn't get expected ${expectedType} message type (msgId = ${expectedMsgId})`);
        }

        if (result.MsgId !== expectedMsgId) {
            throw new Error(
                `Unexpected MsgId received (expected msgId = ${expectedMsgId} but got msgId = ${result.MsgId})`
            );
        }

        if (!result.Result || result.Result !== "OK") {
            const error = result.Error;
            if (error == null) {
                throw new Error("Unknown error.");
            } else {
                throw new Error(`Got error message: ${error}` );
            }
        }

        return result;
    }

    public async getPatterns(): Promise<PatternsMsgResponse> {
        const msgId = this.getNextMsgId();
        const message = {
            Type: "GetPatterns",
            MsgId: msgId,
        };
        this.send(message);
        return await this.getResponse(msgId, "PatternList") as PatternsMsgResponse;
    }

    public async getPatternDetails(patternId: number): Promise<PatternDetailsMsgResponse | undefined> {
        const msgId = this.getNextMsgId();
        const message = {
            Type: "GetPatternDetail",
            MsgId: msgId,
            Id: String(patternId)
        };
        this.send(message);
        return await this.getResponse(msgId, "PatternDetail") as PatternDetailsMsgResponse;
    }

    public async patternStart(patternId: number): Promise<void> {
        const msgId = this.getNextMsgId();
        const message = {
            Type: "PatternStart",
            MsgId: msgId,
            Index: patternId
        };
        this.send(message);
        await this.getResponse(msgId, "Ack");
    }

    public async patternMinMaxChange(menuId: number, newValue: number): Promise<void> {
        const msgId = this.getNextMsgId();
        const message = {
            Type: "PatternMinMaxChange",
            MsgId: msgId,
            MenuId: menuId,
            NewValue: newValue
        };
        this.send(message);
        await this.getResponse(msgId, "Ack");
    }

    public async patternMultiChoiceChange(menuId: number, choiceId: number): Promise<void> {
        const msgId = this.getNextMsgId();
        const message = {
            Type: "PatternMultiChoiceChange",
            MsgId: msgId,
            MenuId: menuId,
            ChoiceId: choiceId
        };
        this.send(message);
        await this.getResponse(msgId, "Ack");
    }

    public async patternSoftButton(pressed: boolean): Promise<void> {
        const msgId = this.getNextMsgId();
        const message = {
            Type: "PatternSoftButton",
            MsgId: msgId,
            Pressed: pressed ? 1 : 0
        };
        this.send(message);
        await this.getResponse(msgId, "Ack");
    }

    public async setPower(chan1: number, chan2: number, chan3: number, chan4: number): Promise<void> {
        const msgId = this.getNextMsgId();
        const message = {
            Type: "SetPower",
            MsgId: msgId,
            Chan1: chan1,
            Chan2: chan2,
            Chan3: chan3,
            Chan4: chan4
        };
        this.send(message);
        await this.getResponse(msgId, "Ack");
    }

    public async patternStop(): Promise<void> {
        const msgId = this.getNextMsgId();
        const message = {
            Type: "PatternStop",
            MsgId: msgId,
        };
        this.send(message);
        await this.getResponse(msgId, "Ack");
    }

    public async getVersionDetails(): Promise<VersionMsgResponse | undefined> {
        const msgId = this.getNextMsgId();
        const message = {
            Type: "GetVersion",
            MsgId: msgId,
        };
        this.send(message);
        return await this.getResponse(msgId, "VersionDetails") as VersionMsgResponse;
    }

    public async sendLuaStart(index: number): Promise<void> {
        const msgId = this.getNextMsgId();
        const message = {
            Type: "LuaStart",
            MsgId: msgId,
            Index: index
        };
        this.send(message);
        await this.getResponse(msgId, "Ack");
    }

    public async sendLuaLine(lineNumber: number, text: string): Promise<void> {
        const msgId = this.getNextMsgId();
        const message = {
            Type: "LuaLine",
            MsgId: msgId,
            LineNumber: lineNumber,
            Text: text.trimEnd()
        };
        this.send(message);
        await this.getResponse(msgId, "Ack");
    }

    public async sendLuaEnd(): Promise<void> {
        const msgId = this.getNextMsgId();
        const message = {
            Type: "LuaEnd",
            MsgId: msgId,
        };
        this.send(message);
        await this.getResponse(msgId, "Ack");
    }

    public async sendGetLuaScripts(): Promise<any[] | undefined> {
        const msgId = this.getNextMsgId();
        const message = {
            Type: "GetLuaScripts",
            MsgId: msgId,
        };
        this.send(message);
        const response = await this.getResponse(msgId, "LuaScripts");
        return response?.Scripts;
    }

    public async sendDeleteLuaScript(index: number): Promise<void> {
        const msgId = this.getNextMsgId();
        const message = {
            Type: "DeleteLuaScript",
            MsgId: msgId,
            Index: index
        };
        this.send(message);
        await this.getResponse(msgId, "Ack");
    }

    private getNextMsgId(): number {
        ++this.msgId

        if (this.msgId > 1000) {
            this.msgId = 1;
        }

        return this.msgId;
    }
}
