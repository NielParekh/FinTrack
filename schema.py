import graphene
from graphene import ObjectType, Field, List, Int, String, Float, Boolean
from datetime import datetime


class TransactionType(graphene.ObjectType):
    """Transaction GraphQL Type"""
    id = Int(required=True)
    type = String(required=True)
    amount = Float(required=True)
    category = String()
    date = String(required=True)
    created_at = String()


class SummaryType(graphene.ObjectType):
    """Summary GraphQL Type"""
    totalIncome = Float(required=True)
    totalExpenses = Float(required=True)
    balance = Float(required=True)


class InvestmentType(graphene.ObjectType):
    bank_balance = Float(required=True)
    hysa_balance = Float(required=True)
    stock_value = Float(required=True)
    last_updated = String()


class InvestmentHistoryType(graphene.ObjectType):
    date = String(required=True)
    bank_balance = Float(required=True)
    hysa_balance = Float(required=True)
    stock_value = Float(required=True)
    net_worth = Float(required=True)


class TransactionFilters(graphene.InputObjectType):
    """Input filters for transactions"""
    type = String()
    month = Int()
    year = Int()


class TransactionInput(graphene.InputObjectType):
    """Input for creating/updating transactions"""
    type = String(required=True)
    amount = Float(required=True)
    category = String()
    date = String(required=True)


class Query(ObjectType):
    """GraphQL Queries"""
    
    investments = Field(InvestmentType)
    investment_history = List(InvestmentHistoryType)

    transactions = List(
        TransactionType,
        filters=graphene.Argument(TransactionFilters)
    )
    
    transaction = Field(TransactionType, id=Int(required=True))
    
    summary = Field(SummaryType, month=Int(), year=Int())
    
    def resolve_investment_history(self, info):
        from app import read_investment_history
        return read_investment_history()

    def resolve_investments(self, info):
        from app import read_investments
        data = read_investments()
        return InvestmentType(
            bank_balance=data.get('bank_balance', 0.0),
            hysa_balance=data.get('hysa_balance', 0.0),
            stock_value=data.get('stock_value', 0.0),
            last_updated=data.get('last_updated')
        )

    def resolve_transactions(self, info, filters=None):
        """Get all transactions with optional filters"""
        # Import here to avoid circular imports
        from app import read_transactions, filter_transactions
        
        transactions = read_transactions()
        
        if filters:
            filtered = filter_transactions(
                transactions,
                filters.type,
                filters.month,
                filters.year
            )
        else:
            filtered = transactions
        
        # Sort by date descending, then by created_at descending
        filtered.sort(key=lambda x: (x['date'], x.get('created_at', '')), reverse=True)
        return filtered
    
    def resolve_transaction(self, info, id):
        """Get a single transaction by ID"""
        from app import read_transactions
        
        transactions = read_transactions()
        for t in transactions:
            if t['id'] == id:
                return t
        return None
    
    def resolve_summary(self, info, month=None, year=None):
        """Get financial summary"""
        from app import read_transactions, filter_transactions
        
        transactions = read_transactions()
        filtered = filter_transactions(transactions, None, month, year)
        
        total_income = sum(t['amount'] for t in filtered if t['type'] == 'income')
        total_expenses = sum(t['amount'] for t in filtered if t['type'] == 'expense')
        balance = total_income - total_expenses
        
        return SummaryType(
            totalIncome=total_income,
            totalExpenses=total_expenses,
            balance=balance
        )


class CreateTransaction(graphene.Mutation):
    """Create a new transaction"""
    class Arguments:
        input = TransactionInput(required=True)
    
    transaction = Field(TransactionType)
    success = Boolean()
    error = String()
    
    def mutate(self, info, input):
        from app import read_transactions, write_transactions, get_next_id, ALLOWED_CATEGORIES

        type_val = input.type
        amount = input.amount
        category = input.category
        date = input.date
        
        # Validation
        if not type_val or not amount or not date:
            return CreateTransaction(success=False, error='Missing required fields')
        
        if type_val not in ['expense', 'income']:
            return CreateTransaction(success=False, error='Type must be either "expense" or "income"')
        
        if float(amount) <= 0:
            return CreateTransaction(success=False, error='Amount must be greater than 0')
        
        if type_val == 'expense':
            if not category:
                return CreateTransaction(success=False, error='Category is required for expenses')
            if category not in ALLOWED_CATEGORIES:
                return CreateTransaction(success=False, error=f'Category must be one of {sorted(ALLOWED_CATEGORIES)}')
        else:
            category = None
        
        transactions = read_transactions()
        
        new_transaction = {
            'id': get_next_id(transactions),
            'type': type_val,
            'amount': float(amount),
            'category': category if category else None,
            'date': date,
            'created_at': datetime.now().isoformat()
        }
        
        transactions.append(new_transaction)
        write_transactions(transactions)
        
        return CreateTransaction(transaction=new_transaction, success=True)


class UpdateTransaction(graphene.Mutation):
    """Update an existing transaction"""
    class Arguments:
        id = Int(required=True)
        input = TransactionInput(required=True)
    
    transaction = Field(TransactionType)
    success = Boolean()
    error = String()
    
    def mutate(self, info, id, input):
        from app import read_transactions, write_transactions, ALLOWED_CATEGORIES

        type_val = input.type
        amount = input.amount
        category = input.category
        date = input.date
        
        # Validation
        if not type_val or not amount or not date:
            return UpdateTransaction(success=False, error='Missing required fields')
        
        if type_val not in ['expense', 'income']:
            return UpdateTransaction(success=False, error='Type must be either "expense" or "income"')
        
        if float(amount) <= 0:
            return UpdateTransaction(success=False, error='Amount must be greater than 0')
        
        if type_val == 'expense':
            if not category:
                return UpdateTransaction(success=False, error='Category is required for expenses')
            if category not in ALLOWED_CATEGORIES:
                return UpdateTransaction(success=False, error=f'Category must be one of {sorted(ALLOWED_CATEGORIES)}')
        else:
            category = None
        
        transactions = read_transactions()
        
        for i, t in enumerate(transactions):
            if t['id'] == id:
                transactions[i].update({
                    'type': type_val,
                    'amount': float(amount),
                    'category': category if category else None,
                    'date': date
                })
                write_transactions(transactions)
                return UpdateTransaction(transaction=transactions[i], success=True)
        
        return UpdateTransaction(success=False, error='Transaction not found')


class DeleteTransaction(graphene.Mutation):
    """Delete a transaction"""
    class Arguments:
        id = Int(required=True)
    
    success = Boolean()
    error = String()
    
    def mutate(self, info, id):
        from app import read_transactions, write_transactions
        
        transactions = read_transactions()
        
        for i, t in enumerate(transactions):
            if t['id'] == id:
                transactions.pop(i)
                write_transactions(transactions)
                return DeleteTransaction(success=True)
        
        return DeleteTransaction(success=False, error='Transaction not found')


class UpdateInvestments(graphene.Mutation):
    class Arguments:
        bank_balance = Float()
        hysa_balance = Float()
        stock_value = Float()

    investment = Field(InvestmentType)
    success = Boolean()
    error = String()

    def mutate(self, info, bank_balance=None, hysa_balance=None, stock_value=None):
        from app import read_investments, write_investments, read_investment_history, write_investment_history
        data = read_investments()
        if bank_balance is not None:
            data['bank_balance'] = bank_balance
        if hysa_balance is not None:
            data['hysa_balance'] = hysa_balance
        if stock_value is not None:
            data['stock_value'] = stock_value
        data['last_updated'] = datetime.now().isoformat()
        write_investments(data)

        # Log to history
        history = read_investment_history()
        history.append({
            'date': datetime.now().strftime('%Y-%m-%d'),
            'bank_balance': data.get('bank_balance', 0.0),
            'hysa_balance': data.get('hysa_balance', 0.0),
            'stock_value': data.get('stock_value', 0.0),
            'net_worth': data.get('bank_balance', 0.0) + data.get('hysa_balance', 0.0) + data.get('stock_value', 0.0),
        })
        write_investment_history(history)

        return UpdateInvestments(
            investment=InvestmentType(
                bank_balance=data['bank_balance'],
                hysa_balance=data.get('hysa_balance', 0.0),
                stock_value=data['stock_value'],
                last_updated=data['last_updated']
            ),
            success=True
        )


class Mutation(ObjectType):
    """GraphQL Mutations"""
    create_transaction = CreateTransaction.Field()
    update_transaction = UpdateTransaction.Field()
    delete_transaction = DeleteTransaction.Field()
    update_investments = UpdateInvestments.Field()


# Create schema
schema = graphene.Schema(query=Query, mutation=Mutation)
