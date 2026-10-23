Attribute VB_Name = "Module1"
Option Explicit

' =====================================================================
' ИМЕНА ЛИСТОВ
' =====================================================================
Private Const SHEET_NAME_SPRAV As String = "Справочник"
Private Const SHEET_NAME_DISCREPANCY As String = "Расхождения"
Private Const SHEET_NAME_REPORT As String = "Отчет_по_категориям"

' =====================================================================
' ОРГАНИЗАЦИИ
' =====================================================================
Private Const ORG_MEN  As String = "МЭН"
Private Const ORG_PAO  As String = "PAO"
Private Const ORG_MUBR As String = "MUBR"


' =====================================================================
' ОСНОВНАЯ ПРОЦЕДУРА
' 1) Пользователь выбирает НЕСКОЛЬКО файлов TrueConf сразу
' 2) Данные всех файлов объединяются в один набор
' 3) Отчётные листы создаются заново (удаляются старые)
' =====================================================================
Sub FillSpravochnikAndCreateReport()
    Dim wbSprav As Workbook: Set wbSprav = ThisWorkbook
    Dim wsSprav As Worksheet
    On Error Resume Next
    Set wsSprav = wbSprav.Sheets(SHEET_NAME_SPRAV)
    On Error GoTo 0
    If wsSprav Is Nothing Then
        MsgBox "Критическая ошибка: Лист '" & SHEET_NAME_SPRAV & "' не найден.", vbCritical
        Exit Sub
    End If

    ' --- Мультивыбор файлов ---
    Dim filePaths As Variant
    filePaths = SelectFiles("Выберите файлы с данными TrueConf (можно несколько)", _
                            "*.xlsx; *.xlsm; *.xls")
    If UBound(filePaths) < 0 Then Exit Sub   ' пользователь отменил выбор

    ToggleAppSettings False

    ' --- Словари обнуляем ПЕРЕД запуском (важно для повторных запусков) ---
    Dim dictAttr As Object, dictTCFull As Object
    Set dictAttr = Nothing
    Set dictTCFull = Nothing

    Dim f As Long, loadedFiles As Long
    Dim wbTC As Workbook, wsTC As Worksheet
    Dim totalFiles As Long: totalFiles = UBound(filePaths) - LBound(filePaths) + 1

    For f = LBound(filePaths) To UBound(filePaths)
        Application.StatusBar = "Обработка файлов: " & (f - LBound(filePaths) + 1) & _
                                " из " & totalFiles & " — " & Dir(CStr(filePaths(f)))
        DoEvents

        Set wbTC = OpenWorkbookSafe(CStr(filePaths(f)))
        If Not wbTC Is Nothing Then
            Set wsTC = wbTC.Sheets(1)
            If LoadTrueConfData(wsTC, dictAttr, dictTCFull) Then
                loadedFiles = loadedFiles + 1
            End If
            wbTC.Close SaveChanges:=False
        End If
    Next f

    Application.StatusBar = False

    If dictAttr Is Nothing Or dictAttr.Count = 0 Then
        MsgBox "Не удалось загрузить данные ни из одного файла TrueConf.", vbExclamation
        ToggleAppSettings True
        Exit Sub
    End If

    MsgBox "Загружено " & dictAttr.Count & " уникальных записей из " & loadedFiles & " файл(ов).", vbInformation

    ' --- Обработка справочника ---
    Dim foundCount As Long, notFoundCount As Long, skippedCount As Long
    ProcessMainData wsSprav, dictAttr, foundCount, notFoundCount, skippedCount

    ' --- Отчёты: каждый раз удаляются старые и создаются заново ---
    CreateDiscrepancyReport wbSprav, dictTCFull, wsSprav
    CreateCategoryReport wbSprav, wsSprav

    ToggleAppSettings True
    MsgBox "Готово!" & vbCrLf & _
           "Обработано файлов: " & loadedFiles & " из " & totalFiles & vbCrLf & _
           "Найдено: " & foundCount & vbCrLf & _
           "Не найдено: " & notFoundCount & vbCrLf & _
           "Пропущено: " & skippedCount, vbInformation
    Exit Sub

ErrHandler:
    Application.StatusBar = False
    ToggleAppSettings True
    MsgBox "Критическая ошибка: " & Err.Description, vbCritical
End Sub


' =====================================================================
' МУЛЬТИВЫБОР ФАЙЛОВ
' Возвращает массив путей. Если пользователь отменил — пустой массив.
' =====================================================================
Private Function SelectFiles(title As String, filter As String) As Variant
    Dim result() As String
    With Application.FileDialog(msoFileDialogFilePicker)
        .title = title
        .Filters.Clear
        .Filters.Add "Файлы Excel", filter
        .AllowMultiSelect = True
        .InitialFileName = ThisWorkbook.Path & "\"
        If .Show = -1 And .SelectedItems.Count > 0 Then
            Dim n As Long: n = .SelectedItems.Count
            ReDim result(1 To n)
            Dim i As Long
            For i = 1 To n
                result(i) = .SelectedItems(i)
            Next i
            SelectFiles = result
        Else
            SelectFiles = Array()   ' пустой массив
        End If
    End With
End Function


' =====================================================================
' ВСПОМОГАТЕЛЬНЫЕ ПРОЦЕДУРЫ
' =====================================================================
Private Function OpenWorkbookSafe(filePath As String) As Workbook
    On Error Resume Next
    Set OpenWorkbookSafe = Workbooks.Open(filePath, ReadOnly:=True, UpdateLinks:=False)
    If Err.Number <> 0 Then Set OpenWorkbookSafe = Nothing
    On Error GoTo 0
End Function

Private Sub ToggleAppSettings(enable As Boolean)
    Application.ScreenUpdating = enable
    Application.Calculation = IIf(enable, xlCalculationAutomatic, xlCalculationManual)
    Application.DisplayAlerts = enable
    If enable Then Application.StatusBar = False
End Sub


' =====================================================================
' ПРОВЕРКА ОРГАНИЗАЦИИ
' =====================================================================
Private Function IsTargetOrganization(company As String) As Boolean
    Dim c As String: c = UCase(Trim(company))
    IsTargetOrganization = (InStr(c, "МЭН") > 0) Or _
                           (InStr(c, "PAO") > 0) Or _
                           (InStr(c, "ПАО") > 0) Or _
                           (InStr(c, "MUBR") > 0) Or _
                           (InStr(c, "МУБР") > 0)
End Function


' =====================================================================
' КЛАСС КОМПАНИИ (МЭН / ПАО / МУБР)
' Разные написания в файлах («OOO "МЭН"», «ПАО «СН-МНГ»», «OOO "МУБР"»)
' и пустая колонка M справочника приводятся к единому классу,
' чтобы сопоставление по ФИО+компания реально работало.
' Пустое значение считается МЭН.
' =====================================================================
Private Function CompanyClass(ByVal company As String) As String
    Dim c As String: c = UCase(Trim(company))
    If Len(c) = 0 Then
        CompanyClass = "МЭН"
    ElseIf InStr(c, "МУБР") > 0 Or InStr(c, "MUBR") > 0 Then
        CompanyClass = "МУБР"
    ElseIf InStr(c, "ПАО") > 0 Or InStr(c, "PAO") > 0 Or _
           InStr(c, "СН-МНГ") > 0 Or InStr(c, "SN-MNG") > 0 Then
        CompanyClass = "ПАО"
    Else
        CompanyClass = "МЭН"
    End If
End Function


' =====================================================================
' ЗАГРУЗКА ДАННЫХ ИЗ TRUECONF
' ВАЖНО: словари НЕ пересоздаются, если уже существуют — так данные
' из нескольких файлов накапливаются в общий набор.
' =====================================================================
Private Function LoadTrueConfData(wsTC As Worksheet, ByRef dictAttr As Object, _
                                  ByRef dictTCFull As Object) As Boolean
    On Error GoTo Err_Load

    If dictAttr Is Nothing Then
        Set dictAttr = CreateObject("Scripting.Dictionary")
        dictAttr.CompareMode = vbTextCompare
    End If
    If dictTCFull Is Nothing Then
        Set dictTCFull = CreateObject("Scripting.Dictionary")
        dictTCFull.CompareMode = vbTextCompare
    End If

    Dim lastRow As Long
    lastRow = wsTC.Cells(wsTC.Rows.Count, 2).End(xlUp).Row
    If lastRow < 2 Then
        LoadTrueConfData = True
        Exit Function
    End If

    Dim arrTC As Variant
    arrTC = wsTC.Range("A2:I" & lastRow).Value2

    Dim j As Long, fioTC As String, attrTC As String, tcInfo As String, dateVal As Variant
    Dim company As String, key As String

    For j = 1 To UBound(arrTC, 1)
        fioTC = NormalizeFIO(CStr(arrTC(j, 2)))
        attrTC = Trim(CStr(arrTC(j, 5)))
        company = Trim(CStr(arrTC(j, 6)))   ' Колонка F: Компания

        If Not IsTargetOrganization(company) Then GoTo NextTC

        If Len(fioTC) > 0 And Len(attrTC) > 0 Then
            key = fioTC & "|" & CompanyClass(company)

            If Not dictAttr.Exists(key) Then dictAttr(key) = attrTC
            If Not dictAttr.Exists(fioTC) Then dictAttr(fioTC) = attrTC

            If Not dictTCFull.Exists(key) Then
                dateVal = arrTC(j, 9)
                tcInfo = attrTC & "|" & Trim(CStr(arrTC(j, 4))) & "|" & _
                         Trim(CStr(arrTC(j, 7))) & "|" & company & "|"
                If IsNumeric(dateVal) And Not IsEmpty(dateVal) Then
                    tcInfo = tcInfo & CStr(CDbl(dateVal))
                Else
                    tcInfo = tcInfo & Trim(CStr(dateVal))
                End If
                dictTCFull(key) = tcInfo
            End If
        End If
NextTC:
    Next j

    LoadTrueConfData = True
    Exit Function
Err_Load:
    LoadTrueConfData = False
End Function


' =====================================================================
' ОБРАБОТКА ОСНОВНОГО СПРАВОЧНИКА
' 1) По совпадению ФИО заполняется колонка I (ID TrueConf).
' 2) Формулы гиперссылок записываются в КАЖДУЮ строку данных:
'    - G (Вызов по TrueConf) — работает, когда заполнен I;
'    - H (Позвонить на № телефона) — работает, когда пользователь
'      вручную заполнил J (#телефона). Формула сама проверяет J:
'      пусто/пробелы — ссылка не показывается, номер есть — показывается.
' =====================================================================
Private Sub ProcessMainData(wsSprav As Worksheet, dictAttr As Object, _
                            ByRef foundCount As Long, ByRef notFoundCount As Long, _
                            ByRef skippedCount As Long)
    Dim lastRowSprav As Long
    lastRowSprav = wsSprav.Cells(wsSprav.Rows.Count, 1).End(xlUp).Row

    ' Колонка J (#телефона) заполняется вручную — делаем её текстовой,
    ' чтобы номер вида "051211" не терял ведущий ноль при вводе.
    wsSprav.Columns(10).NumberFormat = "@"

    Dim i As Long, fio As String, fioNorm As String, attr As String
    Dim company As String, key As String, currentSection As String

    For i = 2 To lastRowSprav
        fio = Trim(CStr(wsSprav.Cells(i, 1).Value))
        If Len(fio) = 0 Or fio = "---" Then
            skippedCount = skippedCount + 1
            GoTo NextRow
        End If

        If IsSectionHeader(fio) Then
            currentSection = fio
            skippedCount = skippedCount + 1
            GoTo NextRow
        End If

        If InStr(fio, " ") = 0 Then
            skippedCount = skippedCount + 1
            GoTo NextRow
        End If

        fioNorm = NormalizeFIO(fio)
        company = Trim(CStr(wsSprav.Cells(i, 13).Value))   ' Колонка M: Компания
        If Len(company) = 0 Then company = currentSection  ' нет M — берём класс из раздела
        If Len(company) = 0 Then company = ORG_MEN

        key = fioNorm & "|" & CompanyClass(company)

        ' --- Гиперссылки записываются всегда, независимо от результата поиска:
        ' проверка выполняется самой формулой (пустая ячейка -> пустая ссылка).
        wsSprav.Cells(i, 7).Formula = "=IF(I" & i & "="""","""",HYPERLINK(""trueconf:""&I" & i & "&""&do=profile"",""Вызов по TrueConf""))"
        wsSprav.Cells(i, 8).Formula = "=IF(TRIM(J" & i & "&"""")="""","""",IFNA(HYPERLINK(""Trueconf:#tel:""&TRIM(J" & i & ")," & """Позвонить на № телефона""" & "),""""))"

        If dictAttr.Exists(key) Then
            attr = dictAttr(key)
            wsSprav.Cells(i, 9).Value = attr
            foundCount = foundCount + 1
        ElseIf dictAttr.Exists(fioNorm) Then
            attr = dictAttr(fioNorm)
            wsSprav.Cells(i, 9).Value = attr
            foundCount = foundCount + 1
        Else
            notFoundCount = notFoundCount + 1
        End If

NextRow:
        If i Mod 200 = 0 Then
            Application.StatusBar = "Обработано: " & i & " из " & lastRowSprav
            DoEvents
        End If
    Next i
End Sub


' =====================================================================
' НОРМАЛИЗАЦИЯ ФИО
' =====================================================================
Private Function NormalizeFIO(ByVal fio As String) As String
    fio = Trim(fio)
    Do While InStr(fio, "  ") > 0
        fio = Replace(fio, "  ", " ")
    Loop
    NormalizeFIO = LCase(fio)
End Function


' =====================================================================
' ПРОВЕРКА: СТРОКА — ЗАГОЛОВОК РАЗДЕЛА?
' =====================================================================
Private Function IsSectionHeader(ByVal text As String) As Boolean
    Dim keywords As String, arrKeywords() As String, k As Long
    keywords = "ИНФОРМАЦИЯ|РУКОВОДСТВО|АППАРАТ|УПРАВЛЕНИЕ|ОТДЕЛ|СЛУЖБА|ЦЕНТР|" & _
               "БРИГАДА|ЦЕХ|ПРОЕКТ|БЛОК|НАПРАВЛЕНИЕ|ГРУППА|ДОЧЕРНИХ|СЕРВИСНЫЕ|" & _
               "РЕГИОНАЛЬНЫЙ|ФИЛИАЛ|ООО|ПАО|МЕГИОНСКАЯ|СТРУКТУРНЫЕ|ТЕЛЕФОН|" & _
               "Фамилия Имя Отчество|ИНВЕСТИЦИЙ|ПЕРСОНАЛОМ|ОРГАНИЗАЦИОННЫМ|ДОБЫЧЕЙ|" & _
               "КООРДИНАЦИИ|БЕЗОПАСНОСТИ|ОХРАНЫ|ГЛАВНОГО МЕХАНИКА|ГЛАВНОГО ЭНЕРГЕТИКА|" & _
               "МУБР|МЭН|МЕГИОНГЕОЛОГИЯ|АБК-1|АБК-2"
    text = UCase(Trim(text))
    arrKeywords = Split(keywords, "|")
    For k = 0 To UBound(arrKeywords)
        If InStr(text, arrKeywords(k)) > 0 Then
            IsSectionHeader = True
            Exit Function
        End If
    Next k
    IsSectionHeader = False
End Function


' =====================================================================
' УДАЛЕНИЕ ЛИСТА (ГАРАНТИРУЕТ ПЕРЕСОЗДАНИЕ С НУЛЯ)
' =====================================================================
Private Sub DeleteSheetIfExists(wb As Workbook, sheetName As String)
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = wb.Sheets(sheetName)
    On Error GoTo 0
    If Not ws Is Nothing Then
        If ws.Visible <> xlSheetVisible Then ws.Visible = xlSheetVisible
        Application.DisplayAlerts = False
        ws.Delete
        Application.DisplayAlerts = True
    End If
End Sub


' =====================================================================
' ОТЧЁТ О РАСХОЖДЕНИЯХ — всегда создаётся заново
' =====================================================================
Private Sub CreateDiscrepancyReport(wb As Workbook, dictTC As Object, wsSprav As Worksheet)
    ' Пересоздаём лист с нуля:
    DeleteSheetIfExists wb, SHEET_NAME_DISCREPANCY
    Dim wsReport As Worksheet
    Set wsReport = wb.Sheets.Add(After:=wb.Sheets(wb.Sheets.Count))
    wsReport.Name = SHEET_NAME_DISCREPANCY

    wsReport.Range("A1:H1").Value = Array("№", "ФИО (из TrueConf)", "Атрибут (ID TrueConf)", _
                                          "Сервер", "Email", "Компания", _
                                          "Дата первого входа", "Статус")
    With wsReport.Range("A1:H1")
        .Font.Bold = True
        .Interior.Color = RGB(68, 84, 106)
        .Font.Color = vbWhite
        .HorizontalAlignment = xlCenter
    End With
    wsReport.Range("A:A").ColumnWidth = 5
    wsReport.Range("B:B").ColumnWidth = 38
    wsReport.Range("C:C").ColumnWidth = 42
    wsReport.Range("D:D").ColumnWidth = 28
    wsReport.Range("E:E").ColumnWidth = 32
    wsReport.Range("F:F").ColumnWidth = 18
    wsReport.Range("G:G").ColumnWidth = 20
    wsReport.Range("H:H").ColumnWidth = 22
    wsReport.Range("A:A").NumberFormat = "0"
    wsReport.Range("G:G").NumberFormat = "yyyy-mm-dd"

    Dim dictSprav As Object: Set dictSprav = CreateObject("Scripting.Dictionary")
    dictSprav.CompareMode = vbTextCompare
    Dim lastRowSprav As Long
    lastRowSprav = wsSprav.Cells(wsSprav.Rows.Count, 1).End(xlUp).Row

    Dim i As Long, fio As String, company As String, rawFio As String
    Dim currentSection As String
    For i = 2 To lastRowSprav
        rawFio = Trim(CStr(wsSprav.Cells(i, 1).Value))
        If Len(rawFio) > 0 And IsSectionHeader(rawFio) Then
            currentSection = rawFio
        End If
        fio = NormalizeFIO(rawFio)
        company = Trim(CStr(wsSprav.Cells(i, 13).Value))
        If Len(company) = 0 Then company = currentSection

        If Len(fio) > 0 And InStr(fio, " ") > 0 And Not IsSectionHeader(rawFio) Then
            dictSprav(fio & "|" & CompanyClass(company)) = True
            dictSprav(fio) = True
        End If
    Next i

    Dim reportRow As Long: reportRow = 2
    Dim discrepancyCount As Long: discrepancyCount = 0
    Dim key As Variant, tcInfo As String, infoParts() As String, dateNum As Double
    Dim fioTC As String, companyTC As String, keyParts() As String

    For Each key In dictTC.Keys
        tcInfo = dictTC(key)
        infoParts = Split(tcInfo, "|")
        keyParts = Split(CStr(key), "|")
        fioTC = keyParts(0)
        companyTC = infoParts(3)

        If Not dictSprav.Exists(fioTC & "|" & CompanyClass(companyTC)) And Not dictSprav.Exists(fioTC) Then
            wsReport.Cells(reportRow, 1).Value = discrepancyCount + 1
            wsReport.Cells(reportRow, 2).Value = Application.WorksheetFunction.Proper(fioTC)
            wsReport.Cells(reportRow, 3).Value = infoParts(0)
            wsReport.Cells(reportRow, 4).Value = infoParts(1)
            wsReport.Cells(reportRow, 5).Value = infoParts(2)
            wsReport.Cells(reportRow, 6).Value = companyTC
            If IsNumeric(infoParts(4)) Then
                dateNum = CDbl(infoParts(4))
                If dateNum > 1 And dateNum < 73000 Then
                    wsReport.Cells(reportRow, 7).Value = CDate(dateNum)
                Else
                    wsReport.Cells(reportRow, 7).Value = "'" & infoParts(4)
                End If
            Else
                wsReport.Cells(reportRow, 7).Value = infoParts(4)
            End If
            wsReport.Cells(reportRow, 8).Value = "Нет в справочнике"
            wsReport.Range("A" & reportRow & ":H" & reportRow).Interior.Color = RGB(255, 242, 204)
            reportRow = reportRow + 1
            discrepancyCount = discrepancyCount + 1
        End If
    Next key

    If discrepancyCount > 0 Then
        With wsReport.Range("A" & reportRow & ":H" & reportRow)
            .Value = Array("", "ИТОГО:", discrepancyCount, "", "", "", "", "пользователей без записи")
            .Font.Bold = True
            .Interior.Color = RGB(255, 192, 0)
        End With
        wsReport.Range("A1:H" & reportRow - 1).AutoFilter
    Else
        wsReport.Cells(reportRow, 2).Value = "Расхождений не найдено"
        wsReport.Cells(reportRow, 2).Font.Color = RGB(0, 128, 0)
        wsReport.Cells(reportRow, 2).Font.Bold = True
    End If
    wsReport.Visible = xlSheetHidden
    wsSprav.Activate
End Sub


' =====================================================================
' ОТЧЁТ ПО КАТЕГОРИЯМ — всегда создаётся заново
' =====================================================================
Private Sub CreateCategoryReport(wb As Workbook, wsSprav As Worksheet)
    Const COL_FIO As Long = 1
    Const COL_PHONE As Long = 10
    Const COL_MOBILE As Long = 11
    Const COL_EMAIL As Long = 12
    Const COL_TRUECONF As Long = 9
    Const COL_COMPANY As Long = 13

    ' Пересоздаём лист с нуля:
    DeleteSheetIfExists wb, SHEET_NAME_REPORT
    Dim wsRep As Worksheet
    Set wsRep = wb.Sheets.Add(After:=wb.Sheets(SHEET_NAME_DISCREPANCY))
    wsRep.Name = SHEET_NAME_REPORT

    wsRep.Range("A1:I1").Value = Array("ФИО", "Должность/Отдел", "Компания", _
                                       "Тип линии", "Телефон", "Мобильный", _
                                       "Email", "TrueConf ID", "Категория службы")
    With wsRep.Range("A1:I1")
        .Font.Bold = True
        .Interior.Color = RGB(0, 112, 192)
        .Font.Color = vbWhite
        .HorizontalAlignment = xlCenter
    End With

    Dim lastRow As Long
    lastRow = wsSprav.Cells(wsSprav.Rows.Count, COL_FIO).End(xlUp).Row
    Dim arrSprav As Variant
    arrSprav = wsSprav.Range("A1:M" & lastRow).Value2

    Dim i As Long, reportRow As Long: reportRow = 2
    Dim currentSection As String, fioStr As String, phoneStr As String, companyStr As String

    For i = 2 To UBound(arrSprav, 1)
        fioStr = Trim(CStr(arrSprav(i, COL_FIO)))
        phoneStr = Trim(CStr(arrSprav(i, COL_PHONE)))
        companyStr = Trim(CStr(arrSprav(i, COL_COMPANY)))
        If Len(companyStr) = 0 Then companyStr = ORG_MEN

        If IsSectionHeader(fioStr) Then
            currentSection = fioStr
            GoTo NextReportRow
        End If
        If Len(fioStr) = 0 Or InStr(fioStr, " ") = 0 Then GoTo NextReportRow

        wsRep.Cells(reportRow, 1).Value = fioStr
        wsRep.Cells(reportRow, 2).Value = currentSection
        wsRep.Cells(reportRow, 3).Value = companyStr
        wsRep.Cells(reportRow, 5).Value = "'" & phoneStr
        wsRep.Cells(reportRow, 6).Value = "'" & Trim(CStr(arrSprav(i, COL_MOBILE)))
        wsRep.Cells(reportRow, 7).Value = Trim(CStr(arrSprav(i, COL_EMAIL)))
        wsRep.Cells(reportRow, 8).Value = Trim(CStr(arrSprav(i, COL_TRUECONF)))
        wsRep.Cells(reportRow, 4).Value = DetermineLineType(phoneStr)
        wsRep.Cells(reportRow, 9).Value = DetermineServiceCategory(currentSection)
        reportRow = reportRow + 1
NextReportRow:
    Next i

    If reportRow > 2 Then
        wsRep.Range("A1:I" & reportRow - 1).AutoFilter
        wsRep.Columns("A:I").AutoFit
    End If
    wsRep.Visible = xlSheetHidden
    wsSprav.Activate
End Sub


' =====================================================================
' ОПРЕДЕЛЕНИЕ ТИПА ЛИНИИ
' =====================================================================
Private Function DetermineLineType(phoneNum As String) As String
    phoneNum = Replace(Replace(phoneNum, "-", ""), " ", "")
    If Len(phoneNum) = 0 Then
        DetermineLineType = "Не указан"
    ElseIf Left(phoneNum, 1) = "2" Or Left(phoneNum, 1) = "3" Then
        DetermineLineType = "Цифровая линия"
    ElseIf IsNumeric(phoneNum) And Len(phoneNum) = 3 Then
        DetermineLineType = "IP-телефония"
    Else
        DetermineLineType = "Аналоговая линия"
    End If
End Function


' =====================================================================
' ОПРЕДЕЛЕНИЕ КАТЕГОРИИ СЛУЖБЫ
' =====================================================================
Private Function DetermineServiceCategory(department As String) As String
    Dim deptUpper As String: deptUpper = UCase(department)
    If InStr(deptUpper, "БЕЗОПАСНОСТ") > 0 Or InStr(deptUpper, "ОХРАН") > 0 Then
        DetermineServiceCategory = "Безопасность и охрана труда"
    ElseIf InStr(deptUpper, "ПРОИЗВОДСТВ") > 0 Or InStr(deptUpper, "ТЕХНИЧЕСК") > 0 Or InStr(deptUpper, "ЦДПН") > 0 Then
        DetermineServiceCategory = "Производственно-технические службы"
    ElseIf InStr(deptUpper, "ФИНАНС") > 0 Or InStr(deptUpper, "ЭКОНОМИ") > 0 Then
        DetermineServiceCategory = "Финансовые управления"
    ElseIf InStr(deptUpper, "ПЕРСОНАЛ") > 0 Or InStr(deptUpper, "КАДР") > 0 Or InStr(deptUpper, "СОЦИАЛЬН") > 0 Then
        DetermineServiceCategory = "Отдел кадров и соц. развития"
    ElseIf InStr(deptUpper, "МЕХАН") > 0 Or InStr(deptUpper, "ЭНЕРГЕТ") > 0 Then
        DetermineServiceCategory = "Службы гл. механика и энергетика"
    ElseIf InStr(deptUpper, "ТРАНСПОРТ") > 0 Or InStr(deptUpper, "ЛОГИСТИК") > 0 Or InStr(deptUpper, "СКЛАД") > 0 Then
        DetermineServiceCategory = "Транспорт и складская логистика"
    ElseIf InStr(deptUpper, "ДОБЫЧ") > 0 Then
        DetermineServiceCategory = "Центр управления добычей"
    ElseIf InStr(deptUpper, "МУБР") > 0 Or InStr(deptUpper, "МЭН") > 0 Or InStr(deptUpper, "МЕГИОНГЕОЛОГИЯ") > 0 Then
        DetermineServiceCategory = "Дочерние общества"
    ElseIf InStr(deptUpper, "PAO") > 0 Or InStr(deptUpper, "ПАО") > 0 Then
        DetermineServiceCategory = "ПАО"
    Else
        DetermineServiceCategory = "Прочие службы"
    End If
End Function


' =====================================================================
' ПЕРЕКЛЮЧАТЕЛИ ВИДИМОСТИ ЛИСТОВ
' =====================================================================
Sub ToggleDiscrepancySheet()
    ToggleSheetVisibility SHEET_NAME_DISCREPANCY
End Sub

Sub ToggleCategoryReport()
    ToggleSheetVisibility SHEET_NAME_REPORT
End Sub

Private Sub ToggleSheetVisibility(sheetName As String)
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(sheetName)
    On Error GoTo 0
    If ws Is Nothing Then
        MsgBox "Лист '" & sheetName & "' не найден.", vbExclamation
        Exit Sub
    End If
    If ws.Visible = xlSheetVisible Then
        ws.Visible = xlSheetHidden
        MsgBox "Лист '" & sheetName & "' скрыт.", vbInformation
    Else
        ws.Visible = xlSheetVisible
        ws.Activate
        MsgBox "Лист '" & sheetName & "' показан.", vbInformation
    End If
End Sub

