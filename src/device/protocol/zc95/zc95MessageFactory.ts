import Zc95Protocol, { Msg, MsgAndResponseIdentifier, MsgResponse } from './zc95Protocol.js';

export type GetPatternDetailMsg = {
    Type: 'GetPatternDetail';
    Id: string;
} & Msg;

export type GetPatternsMsg = {
    Type: 'GetPatterns';
} & Msg;

export type PatternStartMsg = {
    Type: 'PatternStart';
    Index: number;
} & Msg;

export type PatternMinMaxChangeMsg = {
    Type: 'PatternMinMaxChange';
    MenuId: number;
    NewValue: number;
} & Msg;

export type PatternMultiChoiceChangeMsg = {
    Type: 'PatternMultiChoiceChange';
    MenuId: number;
    ChoiceId: number;
} & Msg;

export type PatternSoftButtonMsg = {
    Type: 'PatternSoftButton';
    Pressed: 0 | 1;
} & Msg;

export type SetPowerMsg = {
    Type: 'SetPower';
    Chan1: number;
    Chan2: number;
    Chan3: number;
    Chan4: number;
} & Msg;

export type PatternStopMsg = {
    Type: 'PatternStop';
} & Msg;

export type GetVersionMsg = {
    Type: 'GetVersion';
} & Msg;

export type LuaStartMsg = {
    Type: 'LuaStart';
    Index: number;
} & Msg;

export type LuaEndMsg = {
    Type: 'LuaEnd';
} & Msg;

export type LuaLineMsg = {
    Type: 'LuaLine';
    LineNumber: number;
    Text: string;
} & Msg;

export type GetLuaScriptsMsg = {
    Type: 'GetLuaScripts';
} & Msg;

export type DeleteLuaScriptMsg = {
    Type: 'DeleteLuaScript';
    Index: number;
} & Msg;

export type AckMsgResponse = {
    Type: 'Ack';
} & MsgResponse;

export type VersionMsgResponse = {
    Type: 'VersionDetails';
    ZC95: string;
    WsMajor: number;
    WsMinor: number;
    SerialNo?: string;
} & MsgResponse;

type PatternDetail = {
    Type: 'PatternDetail';
    Id: number;
    Name: string;
};

export type PatternsMsgResponse = {
    Type: 'PatternList';
    Patterns: PatternDetail[];
} & MsgResponse;

type ChannelPowerStatus = {
    Channel: 1 | 2 | 3 | 4;
    OutputPower: number;
    MaxOutputPower: number;
    PowerLimit: number;
};

export type PowerStatusMsgResponse = {
    Channels: ChannelPowerStatus[];
} & MsgResponse;

export type MenuItem = {
    Id: number;
    Title: string;
    Group: number;
    Type: 'MIN_MAX' | 'MULTI_CHOICE';
    Default: number;
};

export type MinMaxMenuItem = {
    Min: number;
    Max: number;
    IncrementStep: number;
    UoM: string;
} & MenuItem;

export type MultiChoiceMenuItem = {
    Choices: { Id: number, Name: string }[];
} & MenuItem;

export type PatternDetailsMsgResponse = {
    Type: 'PatternDetail';
    Name: string;
    Id: number;
    ButtonA: string;
    MenuItems: (MinMaxMenuItem | MultiChoiceMenuItem)[];
} & MsgResponse;

type LuaScriptInfo = {
    Index: number;
    Empty: boolean;
    Valid: boolean;
    Name: string;
};

export type GetLuaScriptsMsgResponse = {
    Scripts: LuaScriptInfo[];
} & MsgResponse;

export default class Zc95MessageFactory
{
    private msgId = 0;

    public createGetPatterns(): MsgAndResponseIdentifier<GetPatternsMsg, PatternsMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return Zc95Protocol.createMessage<GetPatternsMsg, PatternsMsgResponse>(
            {
                Type: 'GetPatterns',
                MsgId: msgId,
            },
            'PatternList',
        );
    }

    public createGetPatternDetails(patternId: number): MsgAndResponseIdentifier<GetPatternDetailMsg, PatternDetailsMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return Zc95Protocol.createMessage<GetPatternDetailMsg, PatternDetailsMsgResponse>(
            {
                Type: 'GetPatternDetail',
                MsgId: msgId,
                Id: String(patternId),
            },
            'PatternDetail',
        );
    }

    public createPatternStart(patternId: number): MsgAndResponseIdentifier<PatternStartMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return Zc95Protocol.createMessage<PatternStartMsg, AckMsgResponse>(
            {
                Type: 'PatternStart',
                MsgId: msgId,
                Index: patternId,
            },
            'Ack',
        );
    }

    public createPatternMinMaxChange(
        menuId: number, newValue: number,
    ): MsgAndResponseIdentifier<PatternMinMaxChangeMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return Zc95Protocol.createMessage<PatternMinMaxChangeMsg, AckMsgResponse>(
            {
                Type: 'PatternMinMaxChange',
                MsgId: msgId,
                MenuId: menuId,
                NewValue: newValue,
            },
            'Ack',
        );
    }

    public createPatternMultiChoiceChange(
        menuId: number, choiceId: number,
    ): MsgAndResponseIdentifier<PatternMultiChoiceChangeMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return Zc95Protocol.createMessage<PatternMultiChoiceChangeMsg, AckMsgResponse>(
            {
                Type: 'PatternMultiChoiceChange',
                MsgId: msgId,
                MenuId: menuId,
                ChoiceId: choiceId,
            },
            'Ack',
        );
    }

    public createPatternSoftButton(pressed: boolean): MsgAndResponseIdentifier<PatternSoftButtonMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return Zc95Protocol.createMessage<PatternSoftButtonMsg, AckMsgResponse>(
            {
                Type: 'PatternSoftButton',
                MsgId: msgId,
                Pressed: pressed ? 1 : 0,
            },
            'Ack',
        );
    }

    public createSetPower(
        chan1: number, chan2: number, chan3: number, chan4: number,
    ): MsgAndResponseIdentifier<SetPowerMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return Zc95Protocol.createMessage<SetPowerMsg, AckMsgResponse>(
            {
                Type: 'SetPower',
                MsgId: msgId,
                Chan1: chan1,
                Chan2: chan2,
                Chan3: chan3,
                Chan4: chan4,
            },
            'Ack',
        );
    }

    public createPatternStop(): MsgAndResponseIdentifier<PatternStopMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return Zc95Protocol.createMessage<PatternStopMsg, AckMsgResponse>(
            {
                Type: 'PatternStop',
                MsgId: msgId,
            },
            'Ack',
        );
    }

    public createGetVersionDetails(): MsgAndResponseIdentifier<GetVersionMsg, VersionMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return Zc95Protocol.createMessage<GetVersionMsg, VersionMsgResponse>(
            {
                Type: 'GetVersion',
                MsgId: msgId,
            },
            'VersionDetails',
        );
    }

    public createLuaStart(index: number): MsgAndResponseIdentifier<LuaStartMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return Zc95Protocol.createMessage<LuaStartMsg, AckMsgResponse>(
            {
                Type: 'LuaStart',
                MsgId: msgId,
                Index: index,
            },
            'Ack',
        );
    }

    public createLuaLine(lineNumber: number, text: string): MsgAndResponseIdentifier<LuaLineMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return Zc95Protocol.createMessage<LuaLineMsg, AckMsgResponse>(
            {
                Type: 'LuaLine',
                MsgId: msgId,
                LineNumber: lineNumber,
                Text: text.trimEnd(),
            },
            'Ack',
        );
    }

    public createLuaEnd(): MsgAndResponseIdentifier<LuaEndMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return Zc95Protocol.createMessage<LuaEndMsg, AckMsgResponse>(
            {
                Type: 'LuaEnd',
                MsgId: msgId,
            },
            'Ack',
        );
    }

    public createGetLuaScripts(): MsgAndResponseIdentifier<GetLuaScriptsMsg, GetLuaScriptsMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return Zc95Protocol.createMessage<GetLuaScriptsMsg, GetLuaScriptsMsgResponse>(
            {
                Type: 'GetLuaScripts',
                MsgId: msgId,
            },
            'LuaScripts',
        );
    }

    public createDeleteLuaScript(index: number): MsgAndResponseIdentifier<DeleteLuaScriptMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return Zc95Protocol.createMessage<DeleteLuaScriptMsg, AckMsgResponse>(
            {
                Type: 'DeleteLuaScript',
                MsgId: msgId,
                Index: index,
            },
            'Ack',
        );
    }

    private getNextMsgIndex(): number {
        if (this.msgId >= 10000) {
            this.msgId = 0;
        }

        return ++this.msgId;
    }
}
