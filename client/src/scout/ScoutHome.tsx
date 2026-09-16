      {primaryOutcomeInput}
      <ScoutControlSnapshot
        snapshot={localCommandSnapshot}
        onPromptSelect={onPromptSelect}
        onContinueConversation={() => onContinuationSelect(meaningfulContinuations[0].id)}
        onNavigate={navigate}
      />
      <div className="px-4"><ScoutWorkPanel onPromptSelect={onPromptSelect} /></div>
    </div>
  );
}
